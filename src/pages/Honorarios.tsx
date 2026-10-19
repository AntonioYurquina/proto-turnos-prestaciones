import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useApp } from '../store';
import { useIdx, type Idx } from '../lib/index';
import { ahora, fechaCorta, fechaDMA, mesDe, nombreMes } from '../lib/dates';
import { valoresTurno } from '../lib/calc';
import { $, nombreCompleto, pct } from '../lib/format';
import { descargarCSV } from '../lib/csv';
import { Badge, Button, Card, Empty, Modal, PageHeader, PrintSheet, Stat, Table } from '../components/ui';
import type { DB, Profesional } from '../types';

function liquidar(db: DB, p: Profesional, periodo: string) {
  const ts = db.turnos.filter((t) => t.estado === 'atendido' && mesDe(t.fecha) === periodo && (p.rol === 'medico' ? t.profesionalId === p.id : t.tecnicoId === p.id)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const filas = ts.map((t) => {
    const v = valoresTurno(db, t);
    const deb = db.debitos.filter((d) => d.turnoId === t.id);
    const debM = deb.reduce((s, d) => s + d.monto, 0);
    const rechazada = deb.some((d) => d.tipo === 'rechazo');
    const base = Math.max(0, v.total - debM);
    const hon = p.esquema.tipo === 'porcentaje' ? Math.round((base * p.esquema.valor) / 100) * 100 : rechazada ? 0 : p.esquema.valor;
    return { t, base, debM, hon, total: v.total };
  });
  return { filas, n: filas.length, base: filas.reduce((s, f) => s + f.base, 0), deb: filas.reduce((s, f) => s + f.debM, 0), hon: filas.reduce((s, f) => s + f.hon, 0) };
}

const esquemaTxt = (p: Profesional) => (p.esquema.tipo === 'porcentaje' ? `${pct(p.esquema.valor, 0)} del valor liquidable` : `${$(p.esquema.valor)} por práctica`);

export default function Honorarios() {
  const { db, imprimir, toast } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const periodos = useMemo(() => [...new Set(db.turnos.filter((t) => t.estado === 'atendido').map((t) => mesDe(t.fecha)))].sort().reverse(), [db.turnos]);
  const [periodo, setPeriodo] = useState(periodos.includes(mesDe(hoy)) ? mesDe(hoy) : periodos[0]);
  const [det, setDet] = useState<string | null>(null);

  const filas = useMemo(() => db.profesionales.map((p) => ({ p, l: liquidar(db, p, periodo) })).filter((x) => x.l.n > 0 || true), [db, periodo]);
  const totMed = filas.filter((x) => x.p.rol === 'medico').reduce((s, x) => s + x.l.hon, 0);
  const totTec = filas.filter((x) => x.p.rol === 'tecnico').reduce((s, x) => s + x.l.hon, 0);
  const facturado = filas.filter((x) => x.p.rol === 'medico').reduce((s, x) => s + x.l.base, 0);
  const seleccionado = det ? db.profesionales.find((p) => p.id === det) : null;

  const csvResumen = () => {
    descargarCSV(`honorarios-${periodo}.csv`, [['Profesional', 'Rol', 'Matrícula', 'Esquema', 'Prácticas', 'Base liquidable', 'Débitos imputados', 'Honorario'],
      ...filas.map(({ p, l }) => [p.nombre, p.rol === 'medico' ? 'Médico/a' : 'Técnico/a', p.matricula, esquemaTxt(p), l.n, l.base, l.deb, l.hon])]);
    toast('CSV descargado.');
  };

  return (
    <>
      <PageHeader title="Honorarios profesionales" subtitle="Liquidación mensual por práctica informada o realizada. El esquema de cada profesional se edita acá mismo y recalcula todo."
        actions={<><select className="inp !w-auto" aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>{periodos.map((p) => <option key={p} value={p}>{nombreMes(p)}</option>)}</select><Button onClick={csvResumen}><Download size={15} /> CSV</Button></>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Honorarios médicos" value={<span className="num text-[22px]">{$(totMed)}</span>} sub={`Sobre ${$(facturado)} liquidables`} />
        <Stat label="Honorarios técnicos" value={<span className="num text-[22px]">{$(totTec)}</span>} />
        <Stat label="Total a liquidar" value={<span className="num text-[22px]">{$(totMed + totTec)}</span>} />
        <Stat label="Prácticas liquidadas" value={filas.filter((x) => x.p.rol === 'medico').reduce((s, x) => s + x.l.n, 0)} sub={`${nombreMes(periodo)}`} />
      </div>

      <Card className="mt-4" title={`Liquidación de ${nombreMes(periodo)}`} subtitle="Base liquidable = valor de convenio de la práctica menos los débitos imputados" bodyClass="p-0">
        <Table>
          <thead className="border-b border-line bg-slate-50"><tr><th className="th">Profesional</th><th className="th">Esquema de pago</th><th className="th text-right">Prácticas</th><th className="th text-right">Base liquidable</th><th className="th text-right">Débitos</th><th className="th text-right">Honorario</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">
            {(['medico', 'tecnico'] as const).map((rol) => (
              <FilasRol key={rol} rol={rol} filas={filas.filter((x) => x.p.rol === rol)} onDetalle={setDet} />
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-slate-50"><tr><td className="td font-semibold" colSpan={5}>Total a liquidar</td><td className="td num text-right font-semibold">{$(totMed + totTec)}</td><td /></tr></tfoot>
        </Table>
      </Card>

      {seleccionado && <Detalle p={seleccionado} periodo={periodo} onClose={() => setDet(null)} imprimir={imprimir} idx={idx} db={db} />}
    </>
  );
}

function FilasRol({ rol, filas, onDetalle }: { rol: 'medico' | 'tecnico'; filas: { p: Profesional; l: ReturnType<typeof liquidar> }[]; onDetalle: (id: string) => void }) {
  const { setEsquema, toast } = useApp();
  return (
    <>
      <tr className="bg-slate-100/60"><td colSpan={7} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rol === 'medico' ? 'Médicos informantes' : 'Técnicos'}</td></tr>
      {filas.map(({ p, l }) => (
        <tr key={p.id} className="hover:bg-slate-50/70">
          <td className="td"><span className="font-medium">{p.nombre}</span><br /><span className="text-xs text-slate-500">{p.especialidad.length > 30 && p.rol === 'tecnico' ? 'Técnico/a' : p.especialidad} · {p.modalidades.join(', ')}</span></td>
          <td className="td">
            <div className="flex items-center gap-1.5">
              <select aria-label={`Tipo de esquema de ${p.nombre}`} className="inp !w-auto !py-1 text-xs" value={p.esquema.tipo}
                onChange={(e) => { const tipo = e.target.value as 'porcentaje' | 'porPractica'; setEsquema(p.id, { tipo, valor: tipo === 'porcentaje' ? 0.25 : p.rol === 'medico' ? 9000 : 3000 }); toast('Esquema actualizado.'); }}>
                <option value="porcentaje">Porcentaje</option><option value="porPractica">Por práctica</option>
              </select>
              <ValorEsquema p={p} />
            </div>
          </td>
          <td className="td num text-right">{l.n}</td><td className="td num text-right">{$(l.base)}</td><td className="td num text-right">{l.deb ? <span className="text-red-700">{`− ${$(l.deb)}`}</span> : <span className="text-slate-400">—</span>}</td><td className="td num text-right font-semibold">{$(l.hon)}</td>
          <td className="td text-right"><Button size="sm" onClick={() => onDetalle(p.id)} disabled={!l.n}>Detalle</Button></td>
        </tr>
      ))}
    </>
  );
}

function ValorEsquema({ p }: { p: Profesional }) {
  const { setEsquema } = useApp();
  const mostrar = p.esquema.tipo === 'porcentaje' ? String(Math.round(p.esquema.valor * 100)) : String(p.esquema.valor);
  const [txt, setTxt] = useState(mostrar);
  const [prev, setPrev] = useState(mostrar);
  if (prev !== mostrar) { setPrev(mostrar); setTxt(mostrar); }
  const n = Number(txt.replace(',', '.'));
  const ok = n > 0 && (p.esquema.tipo === 'porPractica' || n <= 60);
  return (
    <div className="flex items-center gap-1">
      <input aria-label={`Valor del esquema de ${p.nombre}`} inputMode="decimal" className={`inp num !w-24 !py-1 text-right text-xs ${ok ? '' : '!border-red-400'}`} value={txt} onChange={(e) => setTxt(e.target.value)}
        onBlur={() => { if (ok) setEsquema(p.id, { tipo: p.esquema.tipo, valor: p.esquema.tipo === 'porcentaje' ? n / 100 : n }); else setTxt(mostrar); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <span className="text-xs text-slate-500">{p.esquema.tipo === 'porcentaje' ? '%' : '$ / práctica'}</span>
    </div>
  );
}

function Detalle({ p, periodo, onClose, imprimir, idx, db }: { p: Profesional; periodo: string; onClose: () => void; imprimir: (n: React.ReactNode) => void; idx: Idx; db: DB }) {
  const { toast } = useApp();
  const l = liquidar(db, p, periodo);
  const csv = () => {
    descargarCSV(`honorarios-${p.id}-${periodo}.csv`, [['Fecha', 'Hora', 'Paciente (ficticio)', 'Práctica', 'Obra social', 'Valor liquidable', 'Débito imputado', 'Honorario'],
      ...l.filas.map((f) => [f.t.fecha, f.t.hora, nombreCompleto(idx.pac(f.t.pacienteId)), idx.prac(f.t.practicaId).nombre, idx.os(f.t.osId).nombre, f.base, f.debM, f.hon])]);
    toast('CSV descargado.');
  };
  const hoja = (
    <PrintSheet titulo={`Liquidación de honorarios — ${p.nombre}`} subtitulo={`${p.matricula} · ${nombreMes(periodo)} · Esquema: ${esquemaTxt(p)}`}>
      <table>
        <thead><tr><th>Fecha</th><th>Paciente (ficticio)</th><th>Práctica</th><th className="r">Liquidable</th><th className="r">Débito</th><th className="r">Honorario</th></tr></thead>
        <tbody>{l.filas.map((f) => <tr key={f.t.id}><td>{fechaDMA(f.t.fecha)} {f.t.hora}</td><td>{nombreCompleto(idx.pac(f.t.pacienteId))}</td><td>{idx.prac(f.t.practicaId).nombre}</td><td className="r">{$(f.base)}</td><td className="r">{f.debM ? $(f.debM) : '—'}</td><td className="r">{$(f.hon)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={3}><strong>{l.n} prácticas</strong></td><td className="r"><strong>{$(l.base)}</strong></td><td className="r">{$(l.deb)}</td><td className="r"><strong>{$(l.hon)}</strong></td></tr></tfoot>
      </table>
      <p style={{ marginTop: 12, fontSize: 10, color: '#555' }}>Liquidación calculada con valores simulados. Documento de demostración sin validez contable.</p>
    </PrintSheet>
  );
  return (
    <Modal open onClose={onClose} wide title={`Detalle · ${p.nombre}`}
      footer={<><Button onClick={csv}><Download size={15} /> CSV</Button><Button onClick={() => imprimir(hoja)}><Printer size={15} /> Imprimir liquidación</Button><Button variant="primary" onClick={onClose}>Cerrar</Button></>}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><Badge tone="brand">{esquemaTxt(p)}</Badge><span className="text-slate-600">{nombreMes(periodo)} · {l.n} prácticas · honorario <strong className="num">{$(l.hon)}</strong></span></div>
      {l.filas.length === 0 ? <Empty title="Sin prácticas en el período" /> : (
        <Table className="max-h-[50vh] rounded-md border border-line">
          <thead className="sticky top-0 bg-slate-50"><tr><th className="th">Fecha</th><th className="th">Paciente</th><th className="th">Práctica</th><th className="th text-right">Liquidable</th><th className="th text-right">Débito</th><th className="th text-right">Honorario</th></tr></thead>
          <tbody className="divide-y divide-line">{l.filas.map((f) => (
            <tr key={f.t.id}><td className="td num whitespace-nowrap">{fechaCorta(f.t.fecha)} {f.t.hora}</td><td className="td whitespace-nowrap">{nombreCompleto(idx.pac(f.t.pacienteId))}</td><td className="td">{idx.prac(f.t.practicaId).nombre}</td><td className="td num text-right">{$(f.base)}</td><td className="td num text-right">{f.debM ? <span className="text-red-700">{$(f.debM)}</span> : <span className="text-slate-400">—</span>}</td><td className="td num text-right font-medium">{$(f.hon)}</td></tr>))}</tbody>
        </Table>
      )}
    </Modal>
  );
}
