import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Droplets, MessageCircle, Search, ShieldAlert, Utensils } from 'lucide-react';
import { useApp } from '../store';
import { useIdx, WA } from '../lib/index';
import { addDays, ahora, dow, edad, fechaDMA, fechaLarga, fromMin, toMin } from '../lib/dates';
import { avisoAut, convenioDe, estadoAut, finTurno, horarioEquipo, pacienteOcupado, requiereAut, superposiciones, valoresPractica } from '../lib/calc';
import { $, dniFmt, nombreCompleto } from '../lib/format';
import { AutBadge, Badge, Button, EstadoBadge, Field, Modal, cx } from './ui';
import { MODALIDAD_LABEL, type Practica, type Turno } from '../types';

export function prepLines(p: Practica): string[] {
  const o: string[] = [];
  if (p.preparacion?.ayunoHoras) o.push(`Ayuno de ${p.preparacion.ayunoHoras} horas (se puede tomar agua).`);
  if (p.preparacion?.contraste) o.push('Estudio con contraste endovenoso.');
  if (p.preparacion?.nota) o.push(p.preparacion.nota);
  return o;
}

export function PrepBadges({ p }: { p: Practica }) {
  if (!p.preparacion) return null;
  return (
    <>
      {p.preparacion.ayunoHoras && <Badge tone="amber"><Utensils size={11} /> Ayuno {p.preparacion.ayunoHoras} h</Badge>}
      {p.preparacion.contraste && <Badge tone="blue"><Droplets size={11} /> Contraste</Badge>}
      {p.preparacion.nota && !p.preparacion.ayunoHoras && !p.preparacion.contraste && <Badge tone="neutral">Indicaciones previas</Badge>}
    </>
  );
}

/* ----------------------------- Crear / mover ----------------------------- */

interface FormProps {
  open: boolean;
  onClose: () => void;
  turno?: Turno; // si viene, se está moviendo
  inicial?: { fecha?: string; hora?: string; equipoId?: string };
  onSaved?: (t: Turno) => void;
}

export function TurnoForm({ open, onClose, turno, inicial, onSaved }: FormProps) {
  const { db, addTurno, patchTurno, toast } = useApp();
  const idx = useIdx();
  const hoy = ahora();
  const mover = !!turno;

  const eqIni = inicial?.equipoId ?? turno?.equipoId ?? db.equipos[0].id;
  const [q, setQ] = useState('');
  const [pacId, setPacId] = useState(turno?.pacienteId ?? '');
  const [pracId, setPracId] = useState(turno?.practicaId ?? db.practicas.find((p) => p.modalidad === idx.eq(eqIni).modalidad)!.id);
  const [osId, setOsId] = useState(turno?.osId ?? '');
  const [equipoId, setEquipoId] = useState(eqIni);
  const [fecha, setFecha] = useState(turno?.fecha ?? inicial?.fecha ?? hoy.fecha);
  const [hora, setHora] = useState(turno?.hora ?? inicial?.hora ?? '09:00');
  const [profId, setProfId] = useState(turno?.profesionalId ?? '');
  const [tecId, setTecId] = useState(turno?.tecnicoId ?? '');
  const [nota, setNota] = useState(turno?.nota ?? '');

  const pac = pacId ? idx.pac(pacId) : undefined;
  const prac = idx.prac(pracId);
  const equiposOk = db.equipos.filter((e) => e.modalidad === prac.modalidad);
  const eq = equiposOk.find((e) => e.id === equipoId) ?? equiposOk[0];
  const os = osId || pac?.osId || 'part';
  const medicos = db.profesionales.filter((p) => p.rol === 'medico' && p.modalidades.includes(prac.modalidad) && p.sedes.includes(eq.sedeId));
  const tecnicos = db.profesionales.filter((p) => p.rol === 'tecnico' && p.modalidades.includes(prac.modalidad) && p.sedes.includes(eq.sedeId));
  const profSel = medicos.find((p) => p.id === profId) ?? medicos[0];
  const tecSel = tecnicos.find((p) => p.id === tecId) ?? tecnicos[0];

  const resultados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return db.pacientes.filter((p) => `${p.apellido} ${p.nombre} ${p.dni}`.toLowerCase().includes(s)).slice(0, 6);
  }, [q, db.pacientes]);

  const conv = convenioDe(db, os);
  const val = valoresPractica(prac, conv);
  const necesitaAut = requiereAut(db, os, prac);
  const autLibre = useMemo(() => pac ? db.autorizaciones.find((a) => a.pacienteId === pac.id && a.practicaId === prac.id && !a.turnoId && a.osId === os && (a.estado === 'autorizada' || a.estado === 'pendiente')) : undefined, [db.autorizaciones, pac, prac.id, os]);

  // validaciones
  const errores: string[] = [];
  const avisos: string[] = [];
  const h = horarioEquipo(eq, fecha);
  let sugerido: string | null = null;
  const dur = prac.duracion;
  if (!pac) errores.push('Elegí un paciente.');
  if (fecha < hoy.fecha) errores.push('La fecha ya pasó.');
  else if (dow(fecha) === 0 || !h) errores.push(`${eq.codigo} no atiende ese día.`);
  else if (!/^\d{2}:\d{2}$/.test(hora)) errores.push('Indicá la hora.');
  else {
    if (toMin(hora) < toMin(h[0]) || toMin(hora) + dur > toMin(h[1])) errores.push(`Fuera del horario del equipo (${h[0]} a ${h[1]}).`);
    if (fecha === hoy.fecha && toMin(hora) < hoy.minutos && !mover) avisos.push('El horario ya pasó hoy: el turno quedaría como sobreturno.');
    const sup = superposiciones(db, eq.id, fecha, hora, dur, turno?.id);
    if (sup.length) {
      const t = sup[0];
      errores.push(`Se superpone con ${nombreCompleto(idx.pac(t.pacienteId))} (${t.hora}–${fromMin(finTurno(t))}) en ${eq.codigo}.`);
      for (let m = toMin(hora); m + dur <= toMin(h[1]); m += 15) {
        if (!superposiciones(db, eq.id, fecha, fromMin(m), dur, turno?.id).length) { sugerido = fromMin(m); break; }
      }
    }
    if (pac) {
      const po = pacienteOcupado(db, pac.id, fecha, hora, dur, turno?.id);
      if (po.length) errores.push(`El paciente ya tiene otro turno a esa hora (${idx.eq(po[0].equipoId).codigo}, ${po[0].hora}).`);
    }
  }
  if (necesitaAut && !autLibre) avisos.push('Esta práctica requiere autorización previa: se generará un pedido pendiente a la obra social.');
  if (autLibre?.estado === 'pendiente') avisos.push('Hay una autorización pendiente de respuesta para este paciente y práctica; se vincula al turno.');
  if (autLibre?.estado === 'autorizada' && autLibre.vigenciaHasta && autLibre.vigenciaHasta < fecha) avisos.push(`La autorización ${autLibre.nro} vence el ${fechaDMA(autLibre.vigenciaHasta)}, antes de la fecha del turno.`);

  const cambiarPractica = (id: string) => {
    setPracId(id);
    const p = idx.prac(id);
    if (p.modalidad !== eq.modalidad) setEquipoId(db.equipos.find((e) => e.modalidad === p.modalidad)!.id);
  };

  const guardar = () => {
    if (errores.length || !pac) return;
    if (turno) {
      patchTurno(turno.id, { fecha, hora, equipoId: eq.id, profesionalId: profSel.id, tecnicoId: tecSel.id, nota, estado: turno.estado === 'cancelado' ? 'asignado' : turno.estado },
        `Reprogramado a ${fechaDMA(fecha)} ${hora} en ${eq.codigo}`);
      toast('Turno reprogramado.');
      onSaved?.({ ...turno, fecha, hora, equipoId: eq.id });
    } else {
      const t = addTurno({
        fecha, hora, duracion: dur, equipoId: eq.id, pacienteId: pac.id, practicaId: prac.id, osId: os,
        profesionalId: profSel.id, tecnicoId: tecSel.id, estado: 'asignado', nota: nota || undefined, autId: autLibre?.id,
      }, necesitaAut && !autLibre);
      toast(`Turno creado: ${pac.apellido}, ${hora} en ${eq.codigo}.`);
      onSaved?.(t);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide title={mover ? 'Mover turno' : 'Nuevo turno'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={errores.length > 0} onClick={guardar}>{mover ? 'Guardar cambios' : 'Crear turno'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="label">Paciente <span className="font-normal text-slate-400">(ficticio)</span></span>
          {pac ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-slate-50 px-3 py-2">
              <div className="text-sm">
                <p className="font-medium">{nombreCompleto(pac)} <span className="font-normal text-slate-500">· {edad(pac.nacimiento, hoy.fecha)} años</span></p>
                <p className="text-xs text-slate-500">DNI {dniFmt(pac.dni)} · {idx.os(pac.osId).nombre}{pac.afiliado !== '—' ? ` · afiliado ${pac.afiliado}` : ''}</p>
              </div>
              {!mover && <Button size="sm" onClick={() => { setPacId(''); setOsId(''); }}>Cambiar</Button>}
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input className="inp pl-9" placeholder="Buscar por apellido, nombre o DNI (mín. 2 letras)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar paciente" />
              </div>
              {q.trim().length >= 2 && (
                <ul className="mt-1 divide-y divide-line overflow-hidden rounded-md border border-line bg-white">
                  {resultados.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Sin resultados en los pacientes de ejemplo.</li>}
                  {resultados.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50" onClick={() => { setPacId(p.id); setOsId(p.osId); setQ(''); }}>
                        <span className="font-medium">{nombreCompleto(p)}</span>
                        <span className="text-xs text-slate-500">DNI {dniFmt(p.dni)} · {idx.os(p.osId).nombre}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <Field label="Práctica (nomenclador simulado)" className="sm:col-span-2">
          <select className="inp" value={pracId} disabled={mover} onChange={(e) => cambiarPractica(e.target.value)}>
            {(['RM', 'TC', 'MN', 'MG', 'DMO'] as const).map((m) => (
              <optgroup key={m} label={MODALIDAD_LABEL[m]}>
                {db.practicas.filter((p) => p.modalidad === m).map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre} ({p.duracion} min)</option>)}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="Obra social / cobertura">
          <select className="inp" value={os} disabled={mover} onChange={(e) => setOsId(e.target.value)}>
            {db.obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </Field>
        <Field label="Equipo y sede">
          <select className="inp" value={eq.id} onChange={(e) => setEquipoId(e.target.value)}>
            {equiposOk.map((e) => <option key={e.id} value={e.id}>{e.codigo} · {e.nombre} — {idx.sede(e.sedeId).corto}</option>)}
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" className="inp" value={fecha} min={hoy.fecha} max={addDays(hoy.fecha, 120)} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Hora de inicio" hint={`Duración: ${dur} min`}>
          <input type="time" step={900} className="inp" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Field>
        <Field label="Médico/a informante">
          <select className="inp" value={profSel?.id} onChange={(e) => setProfId(e.target.value)}>{medicos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        </Field>
        <Field label="Técnico/a">
          <select className="inp" value={tecSel?.id} onChange={(e) => setTecId(e.target.value)}>{tecnicos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        </Field>
        <Field label="Nota interna (opcional)" className="sm:col-span-2">
          <input className="inp" value={nota} maxLength={140} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: paciente requiere silla de ruedas" />
        </Field>
      </div>

      <div className="mt-4 space-y-2">
        {errores.map((m) => (
          <div key={m} className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{m}{sugerido && m.startsWith('Se superpone') && <> Primer horario libre: <button type="button" className="font-semibold underline" onClick={() => setHora(sugerido!)}>{sugerido}</button>.</>}</span>
          </div>
        ))}
        {avisos.map((m) => (
          <div key={m} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><ShieldAlert size={16} className="mt-0.5 shrink-0" />{m}</div>
        ))}
        {!errores.length && pac && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />Horario libre en {eq.codigo}: {hora} a {fromMin(toMin(hora) + dur)}.</div>
        )}
        {prepLines(prac).length > 0 && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
            <p className="mb-1 font-semibold">Preparación requerida (se incluye en el recordatorio)</p>
            <ul className="list-disc pl-5">{prepLines(prac).map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        )}
        <p className="text-xs text-slate-500">Valor simulado: {$(val.total)} · cubre la obra social {$(val.os)} · copago {$(val.copago)}.</p>
      </div>
    </Modal>
  );
}

/* ------------------------------- Detalle -------------------------------- */

export function mensajeRecordatorio(t: Turno, idx: ReturnType<typeof useIdx>) {
  const pac = idx.pac(t.pacienteId), pr = idx.prac(t.practicaId), eq = idx.eq(t.equipoId), sede = idx.sede(eq.sedeId);
  const prep = prepLines(pr);
  const necesitaAut = idx.os(t.osId) && !idx.os(t.osId).particular;
  return [
    `Hola ${pac.nombre}, te recordamos tu turno para ${pr.nombre}:`,
    `${fechaLarga(t.fecha)} a las ${t.hora} h — ${sede.nombre}, ${sede.direccion}.`,
    ...(prep.length ? ['', 'Preparación:', ...prep.map((p) => `• ${p}`)] : []),
    '',
    `Traé orden médica, DNI${necesitaAut ? ', credencial' : ''} y llegá 15 minutos antes.`,
    'Respondé CONFIRMO para confirmar o AVISO si no podés asistir.',
  ].join('\n');
}

const MOTIVOS_CANCEL = ['Cancelado por el paciente', 'Reprogramado a pedido del paciente', 'Sin autorización de la obra social', 'Equipo fuera de servicio', 'No respondió al recordatorio'];

export function TurnoDetalle({ turnoId, onClose, onMover }: { turnoId: string | null; onClose: () => void; onMover: (t: Turno) => void }) {
  const { db, setEstado, patchTurno, toast } = useApp();
  const idx = useIdx();
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_CANCEL[0]);
  const t = turnoId ? idx.turno(turnoId) : undefined;
  if (!t) return null;
  const pac = idx.pac(t.pacienteId), pr = idx.prac(t.practicaId), eq = idx.eq(t.equipoId);
  const a = idx.aut(t.autId);
  const ea = a ? estadoAut(a, db) : null;
  const av = a ? avisoAut(a, db) : null;
  const v = valoresPractica(pr, convenioDe(db, t.osId));
  const msg = mensajeRecordatorio(t, idx);
  const editable = t.estado === 'asignado' || t.estado === 'confirmado' || t.estado === 'cancelado';

  return (
    <Modal open onClose={() => { setCancelando(false); onClose(); }} wide title={`Turno ${t.hora} · ${eq.codigo}`}
      footer={
        cancelando ? (
          <><Button onClick={() => setCancelando(false)}>Volver</Button><Button variant="danger" onClick={() => { setEstado(t.id, 'cancelado', motivo); toast('Turno cancelado.', 'info'); setCancelando(false); onClose(); }}>Confirmar cancelación</Button></>
        ) : (
          <>
            {editable && t.estado !== 'cancelado' && <Button variant="danger" onClick={() => setCancelando(true)}>Cancelar turno</Button>}
            {editable && <Button onClick={() => { onClose(); onMover(t); }}><CalendarClock size={15} />{t.estado === 'cancelado' ? 'Reprogramar' : 'Mover'}</Button>}
            {t.estado === 'asignado' && <Button variant="primary" onClick={() => { setEstado(t.id, 'confirmado'); toast('Turno confirmado.'); }}>Marcar confirmado</Button>}
            {!editable && <Button onClick={onClose}>Cerrar</Button>}
          </>
        )
      }>
      <div className="flex flex-wrap items-center gap-2">
        <EstadoBadge e={t.estado} />
        <PrepBadges p={pr} />
        {a && ea && <AutBadge e={ea} />}
        {av === 'vence' && <Badge tone="amber">Autorización por vencer</Badge>}
        {av === 'nocubre' && <Badge tone="red">No cubre la fecha del turno</Badge>}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Dato k="Paciente (ficticio)" v={<>{nombreCompleto(pac)}<span className="text-slate-500"> · {edad(pac.nacimiento, ahora().fecha)} años</span></>} />
        <Dato k="DNI / teléfono" v={<span className="num">{dniFmt(pac.dni)} · {pac.telefono}</span>} />
        <Dato k="Estudio solicitado" v={`${pr.nombre} (${pr.codigo})`} />
        <Dato k="Cobertura" v={`${idx.os(t.osId).nombre}${pac.afiliado !== '—' && t.osId === pac.osId ? ` · afiliado ${pac.afiliado}` : ''}`} />
        <Dato k="Fecha y hora" v={`${fechaLarga(t.fecha)}, ${t.hora} a ${fromMin(finTurno(t))}`} />
        <Dato k="Equipo / sede" v={`${eq.nombre} · ${idx.sede(eq.sedeId).nombre}`} />
        <Dato k="Informa" v={idx.prof(t.profesionalId).nombre} />
        <Dato k="Técnico/a" v={idx.prof(t.tecnicoId).nombre} />
        <Dato k="Valor simulado" v={<span className="num">{$(v.total)} · OS {$(v.os)} · copago {$(v.copago)}</span>} />
        {a && <Dato k="Autorización" v={<span className="num">{a.nro ?? 'sin número'}{a.vigenciaHasta ? ` · vigente hasta ${fechaDMA(a.vigenciaHasta)}` : ''}</span>} />}
        {t.nota && <Dato k="Nota interna" v={t.nota} />}
        {t.motivoCancelacion && <Dato k="Motivo de cancelación" v={t.motivoCancelacion} />}
      </dl>

      {prepLines(pr).length > 0 && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
          <p className="mb-1 font-semibold">Preparación del paciente</p>
          <ul className="list-disc pl-5">{prepLines(pr).map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      )}

      {cancelando && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          <Field label="Motivo de la cancelación">
            <select className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS_CANCEL.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <p className="mt-2 text-xs text-red-900">El horario queda libre en la agenda. Si el estudio ya tenía autorización, se conserva para reprogramarlo.</p>
        </div>
      )}

      {(t.estado === 'asignado' || t.estado === 'confirmado') && !cancelando && (
        <div className="mt-4 rounded-md border border-line bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Recordatorio por WhatsApp</p>
            <a className="btn-primary btn-sm btn" href={WA(pac.telefono, msg)} target="_blank" rel="noreferrer"
              onClick={() => patchTurno(t.id, {}, 'Recordatorio de WhatsApp abierto (no se envía desde el prototipo)')}>
              <MessageCircle size={14} /> Abrir en WhatsApp
            </a>
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-line bg-white p-2.5 font-sans text-[13px] leading-relaxed text-slate-700">{msg}</pre>
          <p className="mt-1.5 text-xs text-slate-500">Se arma el enlace wa.me con el mensaje; el prototipo no envía nada. El número es ficticio.</p>
        </div>
      )}

      {t.log && t.log.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Historial del turno</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">{t.log.map((l, i) => <li key={i} className="num">{l}</li>)}</ul>
        </details>
      )}
    </Modal>
  );
}

function Dato({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className={cx()}><dt className="text-xs font-medium text-slate-500">{k}</dt><dd className="mt-0.5 text-ink-900">{v}</dd></div>;
}
