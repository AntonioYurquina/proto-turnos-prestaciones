import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, Boxes, CalendarClock, FileWarning, Hourglass, ShieldAlert, TrendingDown } from 'lucide-react';
import { Bar as RBar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../store';
import { useEquipos, useIdx } from '../lib/index';
import { addDays, ahora, diaCorto, diffDays, dow, fechaCorta, fromMin, mesDe, nombreMes, toMin } from '../lib/dates';
import { activo, avisoAut, esFacturable, estadoAut, ocupacion, resumenLote, stockInfo, valoresTurno } from '../lib/calc';
import { $, $corto, nombreCompleto, pct } from '../lib/format';
import { Bar, Card, Empty, PageHeader, Stat, cx } from '../components/ui';
import { MODALIDAD_LABEL } from '../types';

const AZUL = '#2a78d6', NARANJA = '#eb6834';

export default function Tablero() {
  const { db } = useApp();
  const idx = useIdx();
  const equipos = useEquipos();
  const hoy = ahora();
  const ids = useMemo(() => new Set(equipos.map((e) => e.id)), [equipos]);

  const d = useMemo(() => {
    const deHoy = db.turnos.filter((t) => t.fecha === hoy.fecha && ids.has(t.equipoId));
    const vivos = deHoy.filter(activo);
    const porEquipo = equipos.map((e) => {
      const o = ocupacion(db, hoy.fecha, e.id);
      const ts = deHoy.filter((t) => t.equipoId === e.id);
      return { e, ...o, atendidos: ts.filter((t) => t.estado === 'atendido').length, enSala: ts.filter((t) => t.estado === 'enSala').length, pend: ts.filter((t) => t.estado === 'asignado' || t.estado === 'confirmado').length };
    });
    const disp = porEquipo.reduce((s, x) => s + x.disponibles, 0);
    const ocup = porEquipo.reduce((s, x) => s + x.ocupados, 0);
    // ausentismo 28 días
    const ventana = db.turnos.filter((t) => t.fecha >= addDays(hoy.fecha, -28) && t.fecha <= hoy.fecha && ids.has(t.equipoId) && (t.estado === 'atendido' || t.estado === 'ausente'));
    const aus = ventana.filter((t) => t.estado === 'ausente').length;
    // pendientes de autorización
    const futuros = db.turnos.filter((t) => t.fecha >= hoy.fecha && activo(t) && ids.has(t.equipoId) && t.estado !== 'atendido');
    const pendAut = futuros.filter((t) => { const a = idx.aut(t.autId); return a && estadoAut(a, db, hoy.fecha) === 'pendiente'; });
    const pendAut3 = pendAut.filter((t) => diffDays(t.fecha, hoy.fecha) <= 3);
    // facturación
    const mes = mesDe(hoy.fecha);
    const devengado = db.turnos.filter((t) => mesDe(t.fecha) === mes && esFacturable(db, t)).reduce((s, t) => s + valoresTurno(db, t).os, 0);
    const res = db.lotes.map((l) => resumenLote(db, l.id));
    const porOS = db.obras.filter((o) => !o.particular).map((o) => {
      const r = res.filter((x) => x.lote.osId === o.id);
      return { nombre: o.nombre.replace(' (simulado)', ''), Facturado: r.reduce((s, x) => s + x.presentado, 0), Débitos: r.reduce((s, x) => s + x.totalDeb, 0) };
    }).filter((x) => x.Facturado > 0);
    const presentado = res.reduce((s, x) => s + x.presentado, 0);
    const debitos = res.reduce((s, x) => s + x.totalDeb, 0);
    const cobrado = res.reduce((s, x) => s + x.cobrado, 0);
    // turnos por día (ventana de 5 semanas)
    const dias: { fecha: string; label: string; Turnos: number; hoy: boolean }[] = [];
    for (let i = -14; i <= 14; i++) {
      const f = addDays(hoy.fecha, i);
      if (dow(f) === 0) continue;
      dias.push({ fecha: f, label: diaCorto(f), Turnos: db.turnos.filter((t) => t.fecha === f && ids.has(t.equipoId) && activo(t)).length, hoy: i === 0 });
    }
    // ranking de ocupación en próximos 14 días + últimos 14
    const rank = equipos.map((e) => {
      let o = 0, dsp = 0;
      for (let i = -14; i <= 14; i++) { const x = ocupacion(db, addDays(hoy.fecha, i), e.id); o += x.ocupados; dsp += x.disponibles; }
      return { e, pct: dsp ? o / dsp : 0 };
    }).sort((a, b) => b.pct - a.pct);
    return { deHoy, vivos, porEquipo, ocup: disp ? ocup / disp : 0, aus, ausPct: ventana.length ? aus / ventana.length : 0, ventanaN: ventana.length, pendAut, pendAut3, devengado, porOS, presentado, debitos, cobrado, dias, rank, mes };
  }, [db, equipos, ids, hoy.fecha, idx]);

  const alertas = useMemo(() => {
    const out: { id: string; tono: 'red' | 'amber'; icon: JSX.Element; titulo: string; detalle: string; href: string }[] = [];
    for (const a of db.autorizaciones) {
      const av = avisoAut(a, db, hoy.fecha);
      if (!av) continue;
      const t = a.turnoId ? idx.turno(a.turnoId) : undefined;
      if (t && !ids.has(t.equipoId)) continue;
      out.push({
        id: a.id, tono: av === 'nocubre' ? 'red' : 'amber', icon: <ShieldAlert size={16} />,
        titulo: av === 'nocubre' ? 'La autorización no cubre la fecha del turno' : `Autorización por vencer (${fechaCorta(a.vigenciaHasta!)})`,
        detalle: `${nombreCompleto(idx.pac(a.pacienteId))} · ${idx.prac(a.practicaId).nombre}${t ? ` · turno ${fechaCorta(t.fecha)}` : ' · sin turno asignado'}`, href: '#/autorizaciones',
      });
    }
    const aut = [...out.filter((x) => x.tono === 'red').slice(0, 2), ...out.filter((x) => x.tono === 'amber').slice(0, 2)];
    const ins: typeof out = [];
    for (const c of db.stockCfg) {
      if (equipos.length && sedeOculta(equipos.map((e) => e.sedeId), c.sedeId)) continue;
      const s = stockInfo(db, c.sedeId, c.insumoId, hoy.fecha);
      if (!s || s.estado === 'ok') continue;
      const ins0 = db.insumos.find((i) => i.id === c.insumoId)!;
      ins.push({ id: `${c.sedeId}${c.insumoId}`, tono: s.estado === 'critico' ? 'red' : 'amber', icon: <Boxes size={16} />, titulo: `Insumo bajo: ${ins0.nombre}`, detalle: `${idx.sede(c.sedeId).corto} · stock ${Math.round(s.stock)} ${ins0.unidad} (mínimo ${c.minimo})`, href: '#/insumos' });
    }
    const aEsp = db.turnos.filter((t) => t.fecha === hoy.fecha && t.llegada && t.estado === 'confirmado' && ids.has(t.equipoId) && hoy.minutos - toMin(t.llegada) >= 20);
    const esp = aEsp.slice(0, 2).map((t) => ({ id: `e${t.id}`, tono: 'amber' as const, icon: <Hourglass size={16} />, titulo: `Espera mayor a 20 min`, detalle: `${nombreCompleto(idx.pac(t.pacienteId))} · llegó ${t.llegada} · ${idx.eq(t.equipoId).codigo}`, href: '#/recepcion' }));
    const ab = db.debitos.filter((x) => x.estado === 'abierto');
    const deb = ab.length ? [{ id: 'deb', tono: 'amber' as const, icon: <FileWarning size={16} />, titulo: `${ab.length} débitos sin reclamar`, detalle: `${$(ab.reduce((s, x) => s + x.monto, 0))} para revisar con las obras sociales`, href: '#/facturacion' }] : [];
    return [...aut, ...ins.slice(0, 3), ...esp, ...deb];
  }, [db, equipos, ids, hoy.fecha, hoy.minutos, idx]);

  const sinTurnos = d.deHoy.length === 0;

  return (
    <>
      <PageHeader title="Tablero" subtitle={`Lo que importa hoy en ${equipos.length === 6 ? 'ambas sedes' : idx.sede(equipos[0].sedeId).nombre}: agenda, autorizaciones, facturación e insumos.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Turnos de hoy" icon={<CalendarClock size={16} />} value={d.vivos.length}
          sub={`${d.deHoy.filter((t) => t.estado === 'atendido').length} atendidos · ${d.deHoy.filter((t) => t.estado === 'enSala').length} en sala · ${d.deHoy.filter((t) => t.estado === 'asignado' || t.estado === 'confirmado').length} por venir`} />
        <Stat label="Ocupación de equipos hoy" value={pct(d.ocup)} sub="Minutos agendados sobre horario habilitado" tone={d.ocup > 0.9 ? 'warn' : undefined} icon={<TrendingDown size={16} className="rotate-180" />} />
        <Stat label="Ausentismo (28 días)" value={pct(d.ausPct, 1)} sub={`${d.aus} ausentes sobre ${d.ventanaN} turnos resueltos`} tone={d.ausPct > 0.1 ? 'warn' : undefined} icon={<AlertTriangle size={16} />} />
        <Stat label="Pendientes de autorización" value={d.pendAut.length} sub={`${d.pendAut3.length} con turno en los próximos 3 días`} tone={d.pendAut3.length > 4 ? 'warn' : undefined} icon={<ShieldAlert size={16} />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Turnos de hoy por sede y equipo" subtitle="Ocupación = minutos agendados (sin cancelados) sobre el horario del equipo">
          {sinTurnos ? <Empty title="No hay turnos para hoy" text="Cuando se agenden turnos van a aparecer acá." /> : (
            <ul className="divide-y divide-line">
              {d.porEquipo.map((x) => (
                <li key={x.e.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[210px_1fr_auto]">
                  <div>
                    <p className="text-sm font-semibold">{x.e.nombre} <span className="num text-xs font-normal text-slate-500">{x.e.codigo}</span></p>
                    <p className="text-xs text-slate-500">{idx.sede(x.e.sedeId).corto} · {MODALIDAD_LABEL[x.e.modalidad]}</p>
                  </div>
                  <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                    <Bar value={x.pct} tone={x.pct > 0.9 ? 'amber' : 'brand'} label={`Ocupación ${x.e.nombre}`} />
                    <p className="mt-1 text-[11px] text-slate-500">{x.turnos} turnos · {x.atendidos} atendidos · {x.enSala} en sala · {x.pend} por venir</p>
                  </div>
                  <p className="num text-right text-lg font-semibold">{pct(x.pct)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Alertas" subtitle="Cosas que conviene mirar hoy" bodyClass="p-0">
          {alertas.length === 0 ? <Empty title="Sin alertas" text="No hay autorizaciones por vencer ni insumos bajos." /> : (
            <ul className="divide-y divide-line">
              {alertas.map((a) => (
                <li key={a.id}>
                  <a href={a.href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className={cx('mt-0.5 shrink-0', a.tono === 'red' ? 'text-red-600' : 'text-amber-600')}>{a.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-snug text-ink-900">{a.titulo}</span>
                      <span className="block truncate text-xs text-slate-500">{a.detalle}</span>
                    </span>
                    <ArrowRight size={14} className="mt-1 shrink-0 text-slate-400" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Facturación a obras sociales vs. débitos" subtitle="Lotes presentados por obra social (ambas sedes)">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mini label={`Devengado ${nombreMes(d.mes).split(' ')[0].toLowerCase()}`} v={$(d.devengado)} nota="Prácticas atendidas del mes" />
            <Mini label="Presentado en lotes" v={$(d.presentado)} />
            <Mini label="Débitos" v={$(d.debitos)} tone="bad" nota={d.presentado ? `${pct(d.debitos / d.presentado, 1)} del presentado` : undefined} />
            <Mini label="Cobrado" v={$(d.cobrado)} />
          </div>
          {d.porOS.length === 0 ? <Empty title="Todavía no hay lotes presentados" text="Generá un lote desde Facturación para ver la comparación." /> : (
            <div className="h-60" role="img" aria-label="Gráfico de barras: facturado y débitos por obra social">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.porOS} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="#e5eae8" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5d1' }} />
                  <YAxis tickFormatter={$corto} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={64} />
                  <Tooltip formatter={(v: number) => $(v)} cursor={{ fill: 'rgba(15,111,103,.06)' }} contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #dbe2e0' }} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <RBar dataKey="Facturado" fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <RBar dataKey="Débitos" fill={NARANJA} radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Equipos con mayor ocupación" subtitle="Promedio de las últimas 2 y las próximas 2 semanas">
          <ol className="space-y-3">
            {d.rank.map((x, i) => (
              <li key={x.e.id} className="flex items-center gap-3">
                <span className="num w-4 text-xs text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-[13px]"><span className="truncate font-medium">{x.e.codigo} · {idx.sede(x.e.sedeId).corto}</span><span className="num">{pct(x.pct)}</span></div>
                  <Bar value={x.pct} tone={x.pct > 0.75 ? 'amber' : 'brand'} label={x.e.nombre} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card className="mt-4" title="Turnos por día" subtitle="Dos semanas hacia atrás y dos hacia adelante (sin cancelados). Hoy resaltado.">
        <div className="h-48" role="img" aria-label="Gráfico de barras de turnos por día">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.dias} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e5eae8" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5d1' }} interval={0} angle={-45} textAnchor="end" height={46} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(15,111,103,.06)' }} contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #dbe2e0' }} />
              <RBar dataKey="Turnos" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {d.dias.map((x) => <Cell key={x.fecha} fill={x.hoy ? '#0d6f67' : x.fecha < hoy.fecha ? '#9fb3bd' : '#7fc0ba'} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500">Gris: días pasados · verde claro: agenda futura · verde oscuro: hoy ({fromMin(hoy.minutos)}{hoy.simulado ? ', hora simulada' : ''}).</p>
      </Card>
    </>
  );
}

function sedeOculta(sedesVisibles: string[], sedeId: string) { return !sedesVisibles.includes(sedeId); }

function Mini({ label, v, nota, tone }: { label: string; v: string; nota?: string; tone?: 'bad' }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={cx('num mt-0.5 text-base font-semibold', tone === 'bad' && 'text-red-700')}>{v}</p>
      {nota && <p className="text-[11px] text-slate-500">{nota}</p>}
    </div>
  );
}
