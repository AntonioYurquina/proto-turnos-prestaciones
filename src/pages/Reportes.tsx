import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../store';
import { useIdx } from '../lib/index';
import { addDays, addMeses, ahora, dow, mesDe, nombreMes } from '../lib/dates';
import { horarioEquipo, valoresTurno } from '../lib/calc';
import { $, $corto, pct } from '../lib/format';
import { descargarCSV } from '../lib/csv';
import { toMin } from '../lib/dates';
import { Button, Card, Empty, PageHeader, Table, Tabs } from '../components/ui';
import type { Turno } from '../types';

type Dim = 'equipo' | 'sede' | 'os' | 'prof';

export default function Reportes() {
  const { db, sede, toast } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const [dim, setDim] = useState<Dim>('equipo');
  const [rango, setRango] = useState<'28' | 'mes' | 'prev'>('28');
  const [medida, setMedida] = useState<'n' | 'valor'>('n');

  const [desde, hasta, etiqueta] = useMemo((): [string, string, string] => {
    if (rango === '28') return [addDays(hoy, -27), hoy, 'Últimos 28 días'];
    if (rango === 'mes') return [`${mesDe(hoy)}-01`, hoy, `${nombreMes(mesDe(hoy))} (hasta hoy)`];
    const p = addMeses(mesDe(hoy), -1);
    return [`${p}-01`, addDays(`${mesDe(hoy)}-01`, -1), nombreMes(p)];
  }, [rango, hoy]);

  const filas = useMemo(() => {
    const ts = db.turnos.filter((t) => t.fecha >= desde && t.fecha <= hasta && (sede === 'todas' || idx.eq(t.equipoId).sedeId === sede));
    const dias: string[] = [];
    for (let f = desde; f <= hasta; f = addDays(f, 1)) if (dow(f) !== 0) dias.push(f);
    const agg = (id: string, nombre: string, extra: string, sub: Turno[], equipos: string[]) => {
      const at = sub.filter((t) => t.estado === 'atendido');
      const aus = sub.filter((t) => t.estado === 'ausente').length;
      const can = sub.filter((t) => t.estado === 'cancelado').length;
      const valor = at.reduce((s, t) => s + valoresTurno(db, t).total, 0);
      let disp = 0;
      for (const eid of equipos) for (const f of dias) { const h = horarioEquipo(idx.eq(eid), f); if (h) disp += toMin(h[1]) - toMin(h[0]); }
      const ocup = sub.filter((t) => t.estado !== 'cancelado' && equipos.includes(t.equipoId)).reduce((s, t) => s + t.duracion, 0);
      return { id, nombre, extra, turnos: sub.length - can, atendidos: at.length, ausentes: aus, cancelados: can, valor, ocupacion: equipos.length && disp ? Math.min(1, ocup / disp) : null, ausentismo: at.length + aus ? aus / (at.length + aus) : 0 };
    };
    if (dim === 'equipo') return db.equipos.filter((e) => sede === 'todas' || e.sedeId === sede).map((e) => agg(e.id, `${e.codigo} · ${e.nombre}`, idx.sede(e.sedeId).corto, ts.filter((t) => t.equipoId === e.id), [e.id]));
    if (dim === 'sede') return db.sedes.filter((s) => sede === 'todas' || s.id === sede).map((s) => agg(s.id, s.nombre, '', ts.filter((t) => idx.eq(t.equipoId).sedeId === s.id), db.equipos.filter((e) => e.sedeId === s.id).map((e) => e.id)));
    if (dim === 'os') return db.obras.map((o) => agg(o.id, o.nombre, o.particular ? 'Sin facturación a OS' : '', ts.filter((t) => t.osId === o.id), []));
    return db.profesionales.map((p) => agg(p.id, p.nombre, p.rol === 'medico' ? 'Médico/a' : 'Técnico/a', ts.filter((t) => (p.rol === 'medico' ? t.profesionalId : t.tecnicoId) === p.id), [])).filter((x) => x.turnos > 0);
  }, [db, dim, desde, hasta, sede, idx]);

  const orden = [...filas].sort((a, b) => (medida === 'n' ? b.atendidos - a.atendidos : b.valor - a.valor));
  const tot = filas.reduce((a, f) => ({ turnos: a.turnos + f.turnos, atendidos: a.atendidos + f.atendidos, ausentes: a.ausentes + f.ausentes, cancelados: a.cancelados + f.cancelados, valor: a.valor + f.valor }), { turnos: 0, atendidos: 0, ausentes: 0, cancelados: 0, valor: 0 });
  const verOcup = dim === 'equipo' || dim === 'sede';
  const data = orden.map((f) => ({ nombre: f.nombre.replace(/^(\w+-\d) · /, '$1 · '), valor: medida === 'n' ? f.atendidos : f.valor }));

  const exportar = () => {
    descargarCSV(`produccion-por-${dim}-${desde}_${hasta}.csv`, [
      ['Período', `${desde} a ${hasta}`], [],
      ['Nombre', 'Detalle', 'Turnos (sin cancelados)', 'Atendidos', 'Ausentes', 'Cancelados', 'Ausentismo %', ...(verOcup ? ['Ocupación %'] : []), 'Valor producido (convenio)'],
      ...orden.map((f) => [f.nombre, f.extra, f.turnos, f.atendidos, f.ausentes, f.cancelados, Math.round(f.ausentismo * 1000) / 10, ...(verOcup ? [f.ocupacion === null ? '' : Math.round(f.ocupacion * 1000) / 10] : []), f.valor]),
    ]);
    toast('CSV descargado.');
  };

  return (
    <>
      <PageHeader title="Reportes de producción" subtitle="Producción por equipo, sede, obra social y profesional, con exportación a CSV. Valores a precios de convenio simulados."
        actions={<><select className="inp !w-auto" aria-label="Período" value={rango} onChange={(e) => setRango(e.target.value as typeof rango)}><option value="28">Últimos 28 días</option><option value="mes">Mes actual</option><option value="prev">Mes anterior</option></select><Button onClick={exportar}><Download size={15} /> Exportar CSV</Button></>} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs label="Agrupar por" value={dim} onChange={setDim} tabs={[{ id: 'equipo', label: 'Por equipo' }, { id: 'sede', label: 'Por sede' }, { id: 'os', label: 'Por obra social' }, { id: 'prof', label: 'Por profesional' }]} />
        <p className="text-sm text-slate-600">{etiqueta} · {tot.atendidos} prácticas atendidas · <span className="num">{$(tot.valor)}</span></p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-5" title={medida === 'n' ? 'Prácticas atendidas' : 'Valor producido'}
          actions={<div role="group" aria-label="Medida" className="flex rounded-md bg-slate-200/70 p-0.5 text-xs font-medium">{([['n', 'Cantidad'], ['valor', 'Valor']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={medida === k} onClick={() => setMedida(k)} className={`rounded px-2.5 py-1 ${medida === k ? 'bg-white shadow-sm' : 'text-slate-600'}`}>{l}</button>)}</div>}>
          {data.length === 0 ? <Empty title="Sin datos en el período" /> : (
            <div style={{ height: Math.max(200, data.length * 34 + 30) }} role="img" aria-label={`Gráfico de barras de producción por ${dim}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="#e5eae8" />
                  <XAxis type="number" tickFormatter={(v: number) => (medida === 'n' ? String(v) : $corto(v))} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="nombre" width={dim === 'prof' ? 150 : 190} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => (medida === 'n' ? `${v} prácticas` : $(v))} cursor={{ fill: 'rgba(15,111,103,.06)' }} contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #dbe2e0' }} />
                  <Bar dataKey="valor" fill="#2a78d6" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="valor" position="right" formatter={(v: number) => (medida === 'n' ? v : $corto(v))} style={{ fontSize: 11, fill: '#334155' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-5" title="Detalle" bodyClass="p-0">
          {filas.length === 0 ? <Empty title="Sin datos en el período" /> : (
            <Table>
              <thead className="border-b border-line bg-slate-50"><tr><th className="th">{dim === 'prof' ? 'Profesional' : dim === 'os' ? 'Obra social' : dim === 'sede' ? 'Sede' : 'Equipo'}</th><th className="th text-right">Turnos</th><th className="th text-right">Atendidos</th><th className="th text-right">Ausentes</th><th className="th text-right">Cancel.</th><th className="th text-right">Ausentismo</th>{verOcup && <th className="th text-right">Ocupación</th>}<th className="th text-right">Valor producido</th></tr></thead>
              <tbody className="divide-y divide-line">
                {orden.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70"><td className="td"><span className="font-medium">{f.nombre}</span>{f.extra && <><br /><span className="text-xs text-slate-500">{f.extra}</span></>}</td><td className="td num text-right">{f.turnos}</td><td className="td num text-right font-medium">{f.atendidos}</td><td className="td num text-right">{f.ausentes}</td><td className="td num text-right text-slate-500">{f.cancelados}</td><td className="td num text-right">{pct(f.ausentismo, 1)}</td>{verOcup && <td className="td num text-right">{f.ocupacion === null ? '—' : pct(f.ocupacion)}</td>}<td className="td num text-right">{$(f.valor)}</td></tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-line bg-slate-50"><tr><td className="td font-semibold">Total</td><td className="td num text-right font-semibold">{tot.turnos}</td><td className="td num text-right font-semibold">{tot.atendidos}</td><td className="td num text-right font-semibold">{tot.ausentes}</td><td className="td num text-right font-semibold">{tot.cancelados}</td><td className="td num text-right font-semibold">{pct(tot.atendidos + tot.ausentes ? tot.ausentes / (tot.atendidos + tot.ausentes) : 0, 1)}</td>{verOcup && <td />}<td className="td num text-right font-semibold">{$(tot.valor)}</td></tr></tfoot>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
