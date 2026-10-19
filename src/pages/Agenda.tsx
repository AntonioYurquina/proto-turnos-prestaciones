import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Plus, ShieldAlert, Utensils } from 'lucide-react';
import { useApp } from '../store';
import { useEquipos, useIdx } from '../lib/index';
import { addDays, ahora, diaCorto, fechaLarga, fromMin, inicioSemana, toMin } from '../lib/dates';
import { estadoAut, horarioEquipo, ocupacion } from '../lib/calc';
import { Button, Card, DOT, PageHeader, cx } from '../components/ui';
import { TurnoDetalle, TurnoForm } from '../components/TurnoModals';
import { ESTADO_LABEL, type EstadoTurno, type Equipo, type Turno } from '../types';
import { pct } from '../lib/format';

const INICIO = 8 * 60, FIN = 19 * 60;

const BLOQUE: Record<EstadoTurno, string> = {
  asignado: 'bg-slate-100 border-est-asignado text-ink-900',
  confirmado: 'bg-blue-100 border-est-confirmado text-blue-950',
  enSala: 'bg-amber-100 border-est-sala text-amber-950',
  atendido: 'bg-emerald-100 border-est-atendido text-emerald-950',
  ausente: 'bg-red-100 border-est-ausente text-red-950',
  cancelado: 'hatch bg-slate-50 border-est-cancelado text-slate-500 line-through',
};

export default function Agenda() {
  const { db } = useApp();
  const idx = useIdx();
  const equipos = useEquipos();
  const hoy = ahora();
  const [vista, setVista] = useState<'dia' | 'semana'>('dia');
  const [fecha, setFecha] = useState(hoy.fecha);
  const [paso, setPaso] = useState<15 | 30>(15);
  const [eqSemana, setEqSemana] = useState('');
  const [detalle, setDetalle] = useState<string | null>(null);
  const [form, setForm] = useState<{ turno?: Turno; inicial?: { fecha?: string; hora?: string; equipoId?: string } } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const pxMin = paso === 15 ? 1.75 : 1.2;
  const eqSem = equipos.find((e) => e.id === eqSemana) ?? equipos[0];

  const columnas: { key: string; titulo: string; sub: string; fecha: string; equipo: Equipo }[] = useMemo(() => {
    if (vista === 'dia') return equipos.map((e) => ({ key: e.id, titulo: `${e.codigo} · ${e.nombre}`, sub: idx.sede(e.sedeId).corto, fecha, equipo: e }));
    const lun = inicioSemana(fecha);
    return [0, 1, 2, 3, 4, 5].map((i) => {
      const f = addDays(lun, i);
      return { key: f, titulo: diaCorto(f), sub: f === hoy.fecha ? 'Hoy' : '', fecha: f, equipo: eqSem };
    });
  }, [vista, equipos, fecha, eqSem, idx, hoy.fecha]);

  const turnosDe = (c: { fecha: string; equipo: Equipo }) => db.turnos.filter((t) => t.fecha === c.fecha && t.equipoId === c.equipo.id);

  useEffect(() => {
    if (scroller.current) { const y = (hoy.minutos - INICIO) * pxMin - 300; scroller.current.scrollTop = fecha === hoy.fecha && y > 120 ? y : 0; }
  }, [fecha, vista, paso, hoy.fecha, hoy.minutos, pxMin]);

  const mover = (n: number) => setFecha(addDays(fecha, vista === 'dia' ? n : n * 7));
  const h = (FIN - INICIO) * pxMin;
  const marcas: number[] = [];
  for (let m = INICIO; m < FIN; m += paso) marcas.push(m);

  const conteo = useMemo(() => {
    const out: Record<string, number> = {};
    const fechas = vista === 'dia' ? [fecha] : columnas.map((c) => c.fecha);
    for (const t of db.turnos) if (fechas.includes(t.fecha) && equipos.some((e) => e.id === t.equipoId) && (vista === 'dia' || t.equipoId === eqSem.id)) out[t.estado] = (out[t.estado] ?? 0) + 1;
    return out;
  }, [db.turnos, vista, fecha, columnas, equipos, eqSem]);

  const clickVacio = (e: React.MouseEvent<HTMLDivElement>, c: (typeof columnas)[number]) => {
    const r = e.currentTarget.getBoundingClientRect();
    const m = INICIO + Math.floor((e.clientY - r.top) / pxMin / 15) * 15;
    setForm({ inicial: { fecha: c.fecha, hora: fromMin(m), equipoId: c.equipo.id } });
  };

  return (
    <>
      <PageHeader title="Agenda de turnos" subtitle="Una columna por equipo, una fila por franja. Tocá un turno para ver el detalle o un hueco libre para agendar."
        actions={<Button variant="primary" onClick={() => setForm({ inicial: { fecha: fecha < hoy.fecha ? hoy.fecha : fecha, equipoId: equipos[0].id } })}><Plus size={16} /> Nuevo turno</Button>} />

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1">
            <Button size="sm" aria-label={vista === 'dia' ? 'Día anterior' : 'Semana anterior'} onClick={() => mover(-1)}><ChevronLeft size={16} /></Button>
            <Button size="sm" onClick={() => setFecha(hoy.fecha)} disabled={fecha === hoy.fecha}>Hoy</Button>
            <Button size="sm" aria-label={vista === 'dia' ? 'Día siguiente' : 'Semana siguiente'} onClick={() => mover(1)}><ChevronRight size={16} /></Button>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{vista === 'dia' ? fechaLarga(fecha) : `Semana del ${fechaLarga(inicioSemana(fecha))}`}</p>
            <p className="text-xs text-slate-500">{Object.values(conteo).reduce((a, b) => a + b, 0)} turnos{vista === 'semana' ? ` en ${eqSem.codigo}` : ''}</p>
          </div>
          <input type="date" aria-label="Ir a una fecha" className="inp !w-auto !py-1.5 text-xs" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {vista === 'semana' && (
              <select aria-label="Equipo" className="inp !w-auto !py-1.5 text-xs" value={eqSem.id} onChange={(e) => setEqSemana(e.target.value)}>
                {equipos.map((e) => <option key={e.id} value={e.id}>{e.codigo} · {idx.sede(e.sedeId).corto}</option>)}
              </select>
            )}
            <Seg label="Vista" value={vista} onChange={setVista} opts={[['dia', 'Día'], ['semana', 'Semana']]} />
            <Seg label="Franja" value={String(paso) as '15' | '30'} onChange={(v) => setPaso(Number(v) as 15 | 30)} opts={[['15', '15 min'], ['30', '30 min']]} />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line bg-slate-50 px-4 py-2 text-xs text-slate-600" aria-label="Referencias de estado">
          {(Object.keys(ESTADO_LABEL) as EstadoTurno[]).map((e) => (
            <span key={e} className="inline-flex items-center gap-1.5"><span className={cx('h-2.5 w-2.5 rounded-sm', DOT[e])} />{ESTADO_LABEL[e]} <span className="num text-slate-400">{conteo[e] ?? 0}</span></span>
          ))}
          <span className="inline-flex items-center gap-1 text-slate-500"><Utensils size={11} /> ayuno · <Droplets size={11} /> contraste · <ShieldAlert size={11} className="text-amber-600" /> autorización sin aprobar</span>
        </div>

        <div ref={scroller} className="agenda-scroll relative max-h-[calc(100vh-330px)] min-h-[420px] overflow-auto">
          <div className="grid" style={{ minWidth: 52 + columnas.length * (vista === 'dia' ? 168 : 140), gridTemplateColumns: `52px repeat(${columnas.length}, minmax(${vista === 'dia' ? 168 : 140}px, 1fr))` }}>
            <div className="sticky left-0 top-0 z-30 border-b border-r border-line bg-white" />
            {columnas.map((c) => {
              const o = vista === 'dia' ? ocupacion(db, c.fecha, c.equipo.id) : null;
              const cerrado = !horarioEquipo(c.equipo, c.fecha);
              return (
                <div key={c.key} className="sticky top-0 z-20 border-b border-r border-line bg-white px-2.5 py-2">
                  <p className="truncate text-[13px] font-semibold">{c.titulo}</p>
                  <p className="truncate text-xs text-slate-500">{c.sub}{o && !cerrado ? ` · ${pct(o.pct)} ocup.` : ''}{cerrado ? ' · sin atención' : ''}</p>
                </div>
              );
            })}

            <div className="sticky left-0 z-10 border-r border-line bg-white" style={{ height: h }}>
              {marcas.map((m) => (
                <div key={m} className="absolute left-0 w-[52px] pr-1.5 text-right" style={{ top: (m - INICIO) * pxMin - 6, height: 12 }}>
                  {(m % 60 === 0 || paso === 30) && <span className="num text-[10px] text-slate-500">{fromMin(m)}</span>}
                </div>
              ))}
            </div>

            {columnas.map((c) => {
              const hr = horarioEquipo(c.equipo, c.fecha);
              const ts = turnosDe(c);
              const esHoy = c.fecha === hoy.fecha;
              return (
                <div key={c.key} className="relative border-r border-line" style={{ height: h }}
                  onClick={hr ? (e) => { if (e.target === e.currentTarget) clickVacio(e, c); } : undefined}
                  role="group" aria-label={`${c.titulo}, ${c.fecha}`}>
                  {marcas.map((m) => (
                    <div key={m} className={cx('pointer-events-none absolute inset-x-0 border-t', m % 60 === 0 ? 'border-slate-200' : 'border-slate-100')} style={{ top: (m - INICIO) * pxMin }} />
                  ))}
                  {!hr && <div className="hatch pointer-events-none absolute inset-0 opacity-60" />}
                  {hr && toMin(hr[0]) > INICIO && <div className="hatch pointer-events-none absolute inset-x-0 top-0 opacity-60" style={{ height: (toMin(hr[0]) - INICIO) * pxMin }} />}
                  {hr && toMin(hr[1]) < FIN && <div className="hatch pointer-events-none absolute inset-x-0 bottom-0 opacity-60" style={{ height: (FIN - toMin(hr[1])) * pxMin }} />}
                  {esHoy && hoy.minutos >= INICIO && hoy.minutos <= FIN && (
                    <div className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-red-500" style={{ top: (hoy.minutos - INICIO) * pxMin }}>
                      <span className="absolute -left-0.5 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  )}
                  {ts.map((t) => <Bloque key={t.id} t={t} pxMin={pxMin} onClick={() => setDetalle(t.id)} />)}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <TurnoDetalle turnoId={detalle} onClose={() => setDetalle(null)} onMover={(t) => setForm({ turno: t })} />
      {form && <TurnoForm open turno={form.turno} inicial={form.inicial} onClose={() => setForm(null)} />}
    </>
  );
}

function Bloque({ t, pxMin, onClick }: { t: Turno; pxMin: number; onClick: () => void }) {
  const { db } = useApp();
  const idx = useIdx();
  const pac = idx.pac(t.pacienteId), pr = idx.prac(t.practicaId);
  const a = idx.aut(t.autId);
  const autMal = a && t.estado !== 'atendido' && t.estado !== 'cancelado' && ['pendiente', 'rechazada', 'vencida'].includes(estadoAut(a, db));
  const alto = t.duracion * pxMin - 2;
  const top = (toMin(t.hora) - INICIO) * pxMin + 1;
  return (
    <button type="button" onClick={onClick} style={{ top, height: alto }}
      aria-label={`${t.hora} ${pac.apellido}, ${pac.nombre}, ${pr.nombre}, ${ESTADO_LABEL[t.estado]}`}
      className={cx('absolute inset-x-1 overflow-hidden rounded-[5px] border-l-[3px] px-1.5 py-[2px] text-left shadow-[0_1px_1px_rgba(16,36,49,.08)] ring-1 ring-black/5 transition hover:ring-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500', t.estado === 'cancelado' ? 'z-[1]' : 'z-[2]', BLOQUE[t.estado])}>
      <span className="flex items-center gap-1 text-[11px] font-semibold leading-tight">
        <span className="num">{t.hora}</span>
        <span className="truncate">{pac.apellido}, {pac.nombre.charAt(0)}.</span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-80">
          {pr.preparacion?.ayunoHoras && alto >= 30 && <Utensils size={10} />}
          {pr.preparacion?.contraste && alto >= 30 && <Droplets size={10} />}
          {autMal && <ShieldAlert size={11} className="text-amber-700" />}
        </span>
      </span>
      {alto >= 30 && <span className="mt-px block truncate text-[10.5px] leading-tight opacity-80">{pr.nombre}</span>}
      {alto >= 46 && <span className="block truncate text-[10.5px] leading-tight opacity-70">{idx.os(t.osId).nombre.replace(' (simulado)', '')}</span>}
    </button>
  );
}

function Seg<T extends string>({ value, onChange, opts, label }: { value: T; onChange: (v: T) => void; opts: [T, string][]; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md bg-slate-200/70 p-0.5 text-xs font-medium">
      {opts.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={cx('rounded px-2.5 py-1.5', value === v ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600 hover:text-ink-900')}>{l}</button>
      ))}
    </div>
  );
}
