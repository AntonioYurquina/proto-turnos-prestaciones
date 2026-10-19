import { useMemo, useState } from 'react';
import { Plus, RotateCw, Search, ShieldAlert } from 'lucide-react';
import { useApp } from '../store';
import { useIdx } from '../lib/index';
import { addDays, ahora, fechaDMA, fechaCorta } from '../lib/dates';
import { avisoAut, convenioDe, estadoAut, requiereAut } from '../lib/calc';
import { dniFmt, nombreCompleto } from '../lib/format';
import { AutBadge, Badge, Button, Card, Empty, Field, Modal, PageHeader, Table, Tabs } from '../components/ui';
import type { Autorizacion, EstadoAut } from '../types';

type Filtro = 'todas' | EstadoAut;

export default function Autorizaciones() {
  const { db, patchAut, addAut, toast, sede } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const [tab, setTab] = useState<Filtro>('todas');
  const [osF, setOsF] = useState('todas');
  const [q, setQ] = useState('');
  const [alcance, setAlcance] = useState<'operativas' | 'historial'>('operativas');
  const [limite, setLimite] = useState(40);
  const [modal, setModal] = useState<{ tipo: 'autorizar' | 'rechazar'; a: Autorizacion } | 'nuevo' | null>(null);

  const filas = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.autorizaciones.map((a) => {
      const t = a.turnoId ? idx.turno(a.turnoId) : undefined;
      return { a, t, ea: estadoAut(a, db, hoy), av: avisoAut(a, db, hoy) };
    }).filter(({ a, t, ea }) => {
      if (t && sede !== 'todas' && idx.eq(t.equipoId).sedeId !== sede) return false;
      if (osF !== 'todas' && a.osId !== osF) return false;
      if (alcance === 'operativas') {
        const abierta = !t || t.fecha >= hoy || ea === 'pendiente';
        if (!abierta || (t && (t.estado === 'atendido' || t.estado === 'cancelado' || t.estado === 'ausente') && t.fecha < hoy)) return false;
      }
      if (s) {
        const p = idx.pac(a.pacienteId);
        if (!`${p.apellido} ${p.nombre} ${p.dni} ${a.nro ?? ''}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [db, idx, hoy, osF, q, alcance, sede]);

  const cuenta = (e: Filtro) => (e === 'todas' ? filas.length : filas.filter((f) => f.ea === e).length);
  const visibles = filas.filter((f) => tab === 'todas' || f.ea === tab)
    .sort((x, y) => {
      // lo que requiere gestión primero; dentro de cada grupo, por fecha de turno
      const g = (f: typeof x) => (f.ea === 'pendiente' || f.ea === 'rechazada' || f.ea === 'vencida' || f.av ? 0 : 1);
      const k = (f: typeof x) => (f.t ? `${f.t.fecha} ${f.t.hora}` : '9999');
      return g(x) - g(y) || k(x).localeCompare(k(y));
    });

  const reSolicitar = (a: Autorizacion) => {
    patchAut(a.id, { estado: 'pendiente', nro: undefined, vigenciaHasta: undefined, motivoRechazo: undefined, solicitada: hoy });
    toast('Pedido enviado nuevamente a la obra social (simulado).');
  };

  return (
    <>
      <PageHeader title="Autorizaciones previas" subtitle="Bandeja de pedidos a obras sociales. Las vencidas se detectan por la vigencia, y se avisa si no cubre la fecha del turno."
        actions={<Button variant="primary" onClick={() => setModal('nuevo')}><Plus size={16} /> Nuevo pedido</Button>} />

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <Tabs label="Estado" value={tab} onChange={(v) => { setTab(v); setLimite(40); }} tabs={[
            { id: 'todas', label: 'Todas', count: cuenta('todas') }, { id: 'pendiente', label: 'Pendientes', count: cuenta('pendiente') },
            { id: 'autorizada', label: 'Autorizadas', count: cuenta('autorizada') }, { id: 'rechazada', label: 'Rechazadas', count: cuenta('rechazada') }, { id: 'vencida', label: 'Vencidas', count: cuenta('vencida') },
          ]} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input className="inp !w-60 pl-8 !py-1.5 text-xs" placeholder="Buscar paciente, DNI o Nº" aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="inp !w-auto !py-1.5 text-xs" aria-label="Obra social" value={osF} onChange={(e) => setOsF(e.target.value)}>
              <option value="todas">Todas las obras sociales</option>
              {db.obras.filter((o) => !o.particular).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <select className="inp !w-auto !py-1.5 text-xs" aria-label="Alcance" value={alcance} onChange={(e) => setAlcance(e.target.value as 'operativas' | 'historial')}>
              <option value="operativas">Turnos próximos y sin turno</option>
              <option value="historial">Incluir historial</option>
            </select>
          </div>
        </div>

        {visibles.length === 0 ? <Empty icon={<ShieldAlert size={20} />} title="No hay pedidos con estos filtros" text="Probá con otra obra social o incluí el historial." /> : (
          <Table>
            <thead className="border-b border-line bg-slate-50">
              <tr><th className="th">Paciente</th><th className="th">Estudio</th><th className="th">Obra social</th><th className="th">Turno</th><th className="th">Estado</th><th className="th">Nº / vigencia</th><th className="th text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibles.slice(0, limite).map(({ a, t, ea, av }) => {
                const p = idx.pac(a.pacienteId);
                return (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="td"><span className="font-medium">{nombreCompleto(p)}</span><br /><span className="num text-xs text-slate-500">{dniFmt(p.dni)}</span></td>
                    <td className="td max-w-[190px]"><span className="block truncate" title={idx.prac(a.practicaId).nombre}>{idx.prac(a.practicaId).nombre}</span><span className="num text-[11px] text-slate-500">{a.id} · pedida {fechaCorta(a.solicitada)}</span></td>
                    <td className="td max-w-[130px] leading-snug">{idx.os(a.osId).nombre}</td>
                    <td className="td">{t ? <><span className="num">{fechaCorta(t.fecha)} {t.hora}</span><br /><span className="text-xs text-slate-500">{idx.eq(t.equipoId).codigo}</span></> : <span className="text-xs text-slate-500">Sin turno</span>}</td>
                    <td className="td">
                      <div className="flex flex-col items-start gap-1">
                        <AutBadge e={ea} />
                        {av === 'vence' && <Badge tone="amber">Por vencer</Badge>}
                        {av === 'nocubre' && <Badge tone="red">No cubre el turno</Badge>}
                      </div>
                      {a.motivoRechazo && <p className="mt-1 max-w-[190px] text-xs leading-snug text-slate-500">{a.motivoRechazo}</p>}
                    </td>
                    <td className="td">{a.nro ? <><span className="num text-xs">{a.nro}</span><br /><span className="text-xs text-slate-500">hasta {a.vigenciaHasta ? fechaDMA(a.vigenciaHasta) : '—'}</span></> : <span className="text-slate-400">—</span>}</td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-1.5">
                        {ea === 'pendiente' && <><Button size="sm" variant="primary" onClick={() => setModal({ tipo: 'autorizar', a })}>Autorizar</Button><Button size="sm" onClick={() => setModal({ tipo: 'rechazar', a })}>Rechazar</Button></>}
                        {ea === 'autorizada' && <Button size="sm" title="Editar número y vigencia" onClick={() => setModal({ tipo: 'autorizar', a })}>Editar</Button>}
                        {(ea === 'vencida' || ea === 'rechazada') && <Button size="sm" onClick={() => reSolicitar(a)} title="Enviar nuevamente el pedido a la obra social"><RotateCw size={13} /> Re-pedir</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {visibles.length > limite && <div className="border-t border-line p-3 text-center"><Button size="sm" onClick={() => setLimite(limite + 40)}>Mostrar más ({visibles.length - limite} restantes)</Button></div>}
      </Card>

      {modal && modal !== 'nuevo' && modal.tipo === 'autorizar' && <ModalAutorizar a={modal.a} onClose={() => setModal(null)} />}
      {modal && modal !== 'nuevo' && modal.tipo === 'rechazar' && <ModalRechazar a={modal.a} onClose={() => setModal(null)} />}
      {modal === 'nuevo' && <ModalNuevo onClose={() => setModal(null)} onCreate={(x) => { addAut(x); toast('Pedido de autorización creado como pendiente.'); setModal(null); }} />}
    </>
  );
}

function ModalAutorizar({ a, onClose }: { a: Autorizacion; onClose: () => void }) {
  const { db, patchAut, toast } = useApp();
  const hoy = ahora().fecha;
  const conv = convenioDe(db, a.osId);
  const [nro, setNro] = useState(a.nro ?? `AUT-${Math.floor(2700000 + Math.random() * 90000)}`);
  const [vig, setVig] = useState(a.vigenciaHasta ?? addDays(hoy, conv.vigenciaAutDias));
  const err = !nro.trim() ? 'Ingresá el número que informó la obra social.' : vig < hoy ? 'La vigencia no puede estar en el pasado.' : '';
  return (
    <Modal open onClose={onClose} title={a.estado === 'autorizada' ? 'Editar autorización' : 'Registrar autorización'}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!!err} onClick={() => { patchAut(a.id, { estado: 'autorizada', nro: nro.trim(), vigenciaHasta: vig, motivoRechazo: undefined }); toast('Autorización registrada.'); onClose(); }}>Guardar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Número de autorización"><input className="inp num" value={nro} onChange={(e) => setNro(e.target.value)} /></Field>
        <Field label="Vigente hasta" hint={`Convenio: ${conv.vigenciaAutDias} días de vigencia`}><input type="date" className="inp" value={vig} onChange={(e) => setVig(e.target.value)} /></Field>
      </div>
      {err && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{err}</p>}
    </Modal>
  );
}

const MOTIVOS = ['Falta justificación médica complementaria', 'Práctica fuera de la cobertura del plan', 'Cantidad de prácticas excedida en el período', 'Orden médica incompleta', 'Afiliado con cobertura suspendida'];
function ModalRechazar({ a, onClose }: { a: Autorizacion; onClose: () => void }) {
  const { patchAut, toast } = useApp();
  const [m, setM] = useState(MOTIVOS[0]);
  return (
    <Modal open onClose={onClose} title="Registrar rechazo"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="danger" onClick={() => { patchAut(a.id, { estado: 'rechazada', motivoRechazo: m, nro: undefined, vigenciaHasta: undefined }); toast('Pedido marcado como rechazado.', 'info'); onClose(); }}>Confirmar rechazo</Button></>}>
      <Field label="Motivo informado por la obra social"><select className="inp" value={m} onChange={(e) => setM(e.target.value)}>{MOTIVOS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <p className="mt-3 text-xs text-slate-500">Si el paciente tiene un turno vinculado, queda marcado en la agenda con la autorización sin aprobar.</p>
    </Modal>
  );
}

function ModalNuevo({ onClose, onCreate }: { onClose: () => void; onCreate: (a: Omit<Autorizacion, 'id'>) => void }) {
  const { db } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const [q, setQ] = useState('');
  const [pid, setPid] = useState('');
  const prs = db.practicas.filter((p) => p.modalidad === 'RM' || p.modalidad === 'TC' || p.modalidad === 'MN');
  const [prId, setPrId] = useState(prs[0].id);
  const res = q.trim().length >= 2 ? db.pacientes.filter((p) => `${p.apellido} ${p.nombre} ${p.dni}`.toLowerCase().includes(q.trim().toLowerCase()) && !idx.os(p.osId).particular).slice(0, 6) : [];
  const pac = pid ? idx.pac(pid) : null;
  const turno = pac ? db.turnos.find((t) => t.pacienteId === pac.id && t.practicaId === prId && t.fecha >= hoy && !t.autId && t.estado !== 'cancelado') : undefined;
  const necesita = pac ? requiereAut(db, pac.osId, idx.prac(prId)) : true;
  return (
    <Modal open onClose={onClose} title="Nuevo pedido de autorización"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!pac} onClick={() => pac && onCreate({ pacienteId: pac.id, osId: pac.osId, practicaId: prId, turnoId: turno?.id, estado: 'pendiente', solicitada: hoy })}>Crear pedido</Button></>}>
      <div className="space-y-4">
        <div>
          <span className="label">Paciente (ficticio, con obra social)</span>
          {pac ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-slate-50 px-3 py-2 text-sm"><span>{nombreCompleto(pac)} · {idx.os(pac.osId).nombre}</span><Button size="sm" onClick={() => setPid('')}>Cambiar</Button></div>
          ) : (
            <>
              <input className="inp" placeholder="Apellido, nombre o DNI" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar paciente" />
              {res.length > 0 && <ul className="mt-1 divide-y divide-line rounded-md border border-line">{res.map((p) => <li key={p.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-brand-50" onClick={() => setPid(p.id)}>{nombreCompleto(p)} <span className="text-xs text-slate-500">· {idx.os(p.osId).nombre}</span></button></li>)}</ul>}
            </>
          )}
        </div>
        <Field label="Estudio a autorizar"><select className="inp" value={prId} onChange={(e) => setPrId(e.target.value)}>{prs.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></Field>
        {pac && !necesita && <p className="text-sm text-amber-800">Según el convenio de {idx.os(pac.osId).nombre}, esta práctica no requiere autorización previa; igual podés dejar el pedido registrado.</p>}
        {pac && turno && <p className="text-sm text-emerald-800">Se vincula al turno del {fechaDMA(turno.fecha)} a las {turno.hora}.</p>}
        {pac && !turno && <p className="text-sm text-slate-600">El paciente no tiene un turno próximo para este estudio sin autorización; queda como pedido sin turno.</p>}
      </div>
    </Modal>
  );
}
