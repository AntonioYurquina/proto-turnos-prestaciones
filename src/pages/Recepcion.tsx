import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, DoorOpen, LogIn, UserX } from 'lucide-react';
import { useApp } from '../store';
import { useEquipos, useIdx } from '../lib/index';
import { ahora, fromMin, toMin } from '../lib/dates';
import { estadoAut, requiereAut } from '../lib/calc';
import { dniFmt, nombreCompleto } from '../lib/format';
import { AutBadge, Badge, Button, Card, Empty, EstadoBadge, PageHeader, Stat, cx } from '../components/ui';
import { PrepBadges, TurnoDetalle } from '../components/TurnoModals';
import type { Checklist, Turno } from '../types';

type Item = { k: keyof Checklist; label: string; bloqueo?: string };

export default function Recepcion() {
  const { db, checkIn, setCheck, setEstado, toast } = useApp();
  const idx = useIdx();
  const equipos = useEquipos();
  const hoy = ahora();
  const [detalle, setDetalle] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  const ids = useMemo(() => new Set(equipos.map((e) => e.id)), [equipos]);
  const deHoy = useMemo(() => db.turnos.filter((t) => t.fecha === hoy.fecha && ids.has(t.equipoId) && t.estado !== 'cancelado'), [db.turnos, hoy.fecha, ids]);
  const espera = deHoy.filter((t) => t.llegada && (t.estado === 'asignado' || t.estado === 'confirmado')).sort((a, b) => a.llegada!.localeCompare(b.llegada!));
  const porLlegar = deHoy.filter((t) => !t.llegada && (t.estado === 'asignado' || t.estado === 'confirmado')).sort((a, b) => a.hora.localeCompare(b.hora));
  const enSala = deHoy.filter((t) => t.estado === 'enSala').sort((a, b) => a.hora.localeCompare(b.hora));
  const atendidos = deHoy.filter((t) => t.estado === 'atendido').sort((a, b) => b.hora.localeCompare(a.hora));
  const ausentes = deHoy.filter((t) => t.estado === 'ausente');

  const items = (t: Turno): Item[] => {
    const pr = idx.prac(t.practicaId);
    const a = idx.aut(t.autId);
    const out: Item[] = [{ k: 'orden', label: 'Orden médica' }];
    if (requiereAut(db, t.osId, pr)) {
      const ea = a ? estadoAut(a, db, hoy.fecha) : null;
      out.push({ k: 'autorizacion', label: a?.nro ? `Autorización ${a.nro}` : 'Autorización', bloqueo: ea === 'autorizada' ? undefined : `Autorización ${ea ?? 'inexistente'}: no se puede tildar` });
    }
    out.push({ k: 'dni', label: 'DNI' });
    if (!idx.os(t.osId).particular) out.push({ k: 'credencial', label: 'Credencial' });
    if (pr.preparacion) out.push({ k: 'preparacion', label: pr.preparacion.ayunoHoras ? 'Ayuno/preparación cumplida' : 'Indicaciones previas cumplidas' });
    return out;
  };
  const completo = (t: Turno) => items(t).every((i) => t.checks[i.k] && !i.bloqueo);

  const hacerCheckIn = (t: Turno) => { checkIn(t.id, fromMin(ahora().minutos)); toast(`Llegada registrada: ${idx.pac(t.pacienteId).apellido}.`); };

  const filaBase = (t: Turno) => {
    const p = idx.pac(t.pacienteId), pr = idx.prac(t.practicaId), eq = idx.eq(t.equipoId);
    return { p, pr, eq };
  };

  return (
    <>
      <PageHeader title="Recepción y sala de espera" subtitle="Cola del día en orden de llegada: registrá el ingreso, verificá requisitos y pasá al paciente a sala."
        actions={hoy.simulado ? <Badge tone="amber"><Clock size={11} /> Hora simulada {fromMin(hoy.minutos)}</Badge> : <Badge tone="brand"><Clock size={11} /> {fromMin(hoy.minutos)}</Badge>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Por llegar" value={porLlegar.length} />
        <Stat label="En espera" value={espera.length} tone={espera.some((t) => hoy.minutos - toMin(t.llegada!) > 20) ? 'warn' : undefined} />
        <Stat label="En sala" value={enSala.length} />
        <Stat label="Atendidos" value={atendidos.length} />
        <Stat label="Ausentes" value={ausentes.length} tone={ausentes.length > 3 ? 'warn' : undefined} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card title={`Sala de espera (${espera.length})`} subtitle="Orden de llegada. El pase a sala se habilita con los requisitos completos." bodyClass="p-0">
            {espera.length === 0 ? <Empty icon={<DoorOpen size={20} />} title="No hay pacientes esperando" text="Cuando registres una llegada, el paciente aparece acá con su checklist." /> : (
              <ul className="divide-y divide-line">
                {espera.map((t, i) => {
                  const { p, pr, eq } = filaBase(t);
                  const its = items(t);
                  const ok = completo(t);
                  const min = Math.max(0, hoy.minutos - toMin(t.llegada!));
                  const hechos = its.filter((x) => t.checks[x.k] && !x.bloqueo).length;
                  return (
                    <li key={t.id} className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white" title="Orden de llegada">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setDetalle(t.id)} className="text-left text-sm font-semibold hover:underline">{nombreCompleto(p)}</button>
                          <p className="text-xs text-slate-600">{pr.nombre} · {eq.codigo} · turno {t.hora}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone={min > 20 ? 'amber' : 'neutral'}><Clock size={11} /> llegó {t.llegada} · espera {min} min</Badge>
                            <PrepBadges p={pr} />
                          </div>
                        </div>
                        <span className="num shrink-0 text-xs text-slate-500">{hechos}/{its.length}</span>
                      </div>
                      <fieldset className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        <legend className="sr-only">Requisitos de {nombreCompleto(p)}</legend>
                        {its.map((it) => (
                          <label key={it.k} className={cx('flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px]', it.bloqueo ? 'border-amber-200 bg-amber-50 text-amber-900' : t.checks[it.k] ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-white')} title={it.bloqueo}>
                            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!t.checks[it.k] && !it.bloqueo} disabled={!!it.bloqueo} onChange={(e) => setCheck(t.id, it.k, e.target.checked)} />
                            <span className="flex-1">{it.label}</span>
                            {it.bloqueo && <span className="text-[11px]">sin aprobar</span>}
                          </label>
                        ))}
                      </fieldset>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button variant="primary" size="sm" disabled={!ok} onClick={() => { setEstado(t.id, 'enSala'); toast(`${p.apellido} pasó a sala (${eq.codigo}).`); }}><DoorOpen size={14} /> Pasar a sala</Button>
                        <Button size="sm" onClick={() => { setEstado(t.id, 'ausente'); toast('Marcado como ausente.', 'info'); }}><UserX size={14} /> Ausente</Button>
                        {!ok && <span className="text-xs text-amber-800">Faltan requisitos para pasar a sala.</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={`En sala (${enSala.length})`} bodyClass="p-0">
            {enSala.length === 0 ? <Empty title="Ninguna sala ocupada" /> : (
              <ul className="divide-y divide-line">
                {enSala.map((t) => {
                  const { p, pr, eq } = filaBase(t);
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => setDetalle(t.id)} className="text-left text-sm font-semibold hover:underline">{nombreCompleto(p)}</button>
                        <p className="text-xs text-slate-600">{pr.nombre} · {eq.codigo} ({idx.sede(eq.sedeId).corto}) · turno {t.hora}</p>
                      </div>
                      <EstadoBadge e="enSala" />
                      <Button size="sm" variant="primary" onClick={() => { setEstado(t.id, 'atendido'); toast(`${p.apellido}: estudio finalizado.`); }}><CheckCircle2 size={14} /> Marcar atendido</Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card title={`Por llegar (${porLlegar.length})`} subtitle="Turnos de hoy sin ingreso registrado, por horario" bodyClass="p-0">
          {porLlegar.length === 0 ? <Empty title="No quedan turnos por llegar" /> : (
            <ul className="divide-y divide-line">
              {(verTodos ? porLlegar : porLlegar.slice(0, 9)).map((t) => {
                const { p, pr, eq } = filaBase(t);
                const a = idx.aut(t.autId);
                const atrasado = toMin(t.hora) + 10 < hoy.minutos;
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className={cx('num w-12 text-sm font-semibold', atrasado && 'text-red-700')}>{t.hora}</span>
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => setDetalle(t.id)} className="text-left text-sm font-medium hover:underline">{nombreCompleto(p)}</button>
                      <p className="truncate text-xs text-slate-500">{pr.nombre} · {eq.codigo} · DNI {dniFmt(p.dni)}</p>
                      <div className="mt-1 flex flex-wrap gap-1"><Badge>{idx.os(t.osId).nombre.replace(' (simulado)', '')}</Badge>{a && <AutBadge e={estadoAut(a, db, hoy.fecha)} />}{atrasado && <Badge tone="red">Demorado</Badge>}</div>
                    </div>
                    <Button size="sm" onClick={() => hacerCheckIn(t)}><LogIn size={14} /> Check-in</Button>
                  </li>
                );
              })}
            </ul>
          )}
          {porLlegar.length > 9 && <div className="border-t border-line p-3 text-center"><Button size="sm" onClick={() => setVerTodos(!verTodos)}>{verTodos ? 'Ver menos' : `Ver los ${porLlegar.length} turnos`}</Button></div>}
        </Card>
      </div>

      <Card className="mt-4" title={`Atendidos hoy (${atendidos.length}) y ausentes (${ausentes.length})`} bodyClass="p-0">
        {atendidos.length + ausentes.length === 0 ? <Empty title="Todavía no hay estudios finalizados hoy" /> : (
          <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
            {[...atendidos.slice(0, 8), ...ausentes].map((t) => {
              const { p, pr, eq } = filaBase(t);
              return (
                <li key={t.id} className="flex items-center gap-3 border-line px-4 py-2 sm:border-b">
                  <span className="num w-12 text-sm text-slate-500">{t.hora}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{nombreCompleto(p)}</span><span className="block truncate text-xs text-slate-500">{pr.nombre} · {eq.codigo}</span></span>
                  <EstadoBadge e={t.estado} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <TurnoDetalle turnoId={detalle} onClose={() => setDetalle(null)} onMover={() => { window.location.hash = '#/agenda'; }} />
    </>
  );
}
