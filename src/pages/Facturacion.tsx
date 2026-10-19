import { useMemo, useState } from 'react';
import { Download, FilePlus2, Printer, Receipt } from 'lucide-react';
import { useApp } from '../store';
import { useIdx, type Idx } from '../lib/index';
import { ahora, fechaCorta, fechaDMA, mesDe, nombreMes } from '../lib/dates';
import { convenioDe, esFacturable, loteDeTurno, resumenLote, valoresTurno } from '../lib/calc';
import { $, dniFmt, nombreCompleto, pct } from '../lib/format';
import { descargarCSV } from '../lib/csv';
import { MOTIVOS_DEBITO } from '../lib/seed';
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, PrintSheet, Stat, Table, Tabs } from '../components/ui';
import type { DB, Debito, Turno } from '../types';
import { MODALIDAD_LABEL } from '../types';

type Tab = 'produccion' | 'lotes' | 'debitos' | 'convenios';

function filasLote(db: DB, idx: Idx, ts: Turno[]) {
  return ts.map((t) => {
    const p = idx.pac(t.pacienteId), pr = idx.prac(t.practicaId), v = valoresTurno(db, t);
    return { t, p, pr, v };
  });
}

export default function Facturacion() {
  const { db, generarLote, toast, imprimir } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const [tab, setTab] = useState<Tab>('produccion');
  const [osId, setOsId] = useState('prov');
  const periodos = useMemo(() => [...new Set(db.turnos.filter((t) => t.estado === 'atendido').map((t) => mesDe(t.fecha)))].sort().reverse(), [db.turnos]);
  const [periodo, setPeriodo] = useState(periodos.find((p) => db.lotes.some((l) => l.periodo === p)) ?? periodos[0]);
  const [loteAbierto, setLoteAbierto] = useState<string | null>(null);
  const [limite, setLimite] = useState(30);
  const [debitoDe, setDebitoDe] = useState<Turno | null>(null);

  const os = idx.os(osId), conv = convenioDe(db, osId);
  const hechos = useMemo(() => db.turnos.filter((t) => t.osId === osId && mesDe(t.fecha) === periodo && esFacturable(db, t)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)), [db, osId, periodo]);
  const sinFacturar = hechos.filter((t) => !loteDeTurno(db, t.id));
  const lotesPer = db.lotes.filter((l) => l.osId === osId && l.periodo === periodo);
  const resPer = lotesPer.map((l) => resumenLote(db, l.id));
  const totales = hechos.reduce((a, t) => { const v = valoresTurno(db, t); return { total: a.total + v.total, os: a.os + v.os, copago: a.copago + v.copago }; }, { total: 0, os: 0, copago: 0 });
  const sinFactImporte = sinFacturar.reduce((s, t) => s + valoresTurno(db, t).os, 0);
  const debPer = resPer.reduce((s, r) => s + r.totalDeb, 0);
  const cobPer = resPer.reduce((s, r) => s + r.cobrado, 0);

  const generar = () => {
    const l = generarLote(osId, periodo, hoy);
    if (l) { toast(`Lote ${l.id} generado con ${l.turnoIds.length} prácticas.`); setLoteAbierto(l.id); }
  };

  const lotesTodos = db.lotes.filter((l) => l.osId === osId).sort((a, b) => b.generado.localeCompare(a.generado));
  const debitosOS = db.debitos.filter((d) => d.osId === osId).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <PageHeader title="Facturación a obras sociales" subtitle="Prácticas realizadas valorizadas con el convenio, lotes por período, débitos y conciliación de cobros. Nomenclador y valores simulados."
        actions={
          <>
            <select className="inp !w-auto" aria-label="Obra social" value={osId} onChange={(e) => { setOsId(e.target.value); setLimite(30); }}>
              {db.obras.filter((o) => !o.particular).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <select className="inp !w-auto" aria-label="Período" value={periodo} onChange={(e) => { setPeriodo(e.target.value); setLimite(30); }}>
              {periodos.map((p) => <option key={p} value={p}>{nombreMes(p)}</option>)}
            </select>
          </>
        } />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Prácticas realizadas" value={hechos.length} sub={`${sinFacturar.length} sin facturar`} />
        <Stat label="Valor de convenio" value={<span className="num text-[22px]">{$(totales.total)}</span>} sub={`Factor ${conv.factor.toFixed(2).replace('.', ',')} sobre nomenclador`} />
        <Stat label={`A facturar a la OS (${pct(conv.cobertura)})`} value={<span className="num text-[22px]">{$(totales.os)}</span>} sub={`Copago afiliados ${$(totales.copago)}`} />
        <Stat label="Sin facturar" value={<span className="num text-[22px]">{$(sinFactImporte)}</span>} tone={sinFactImporte ? 'warn' : undefined} sub={sinFacturar.length ? 'Listo para generar lote' : 'Todo el período está en lotes'} />
        <Stat label="Débitos" value={<span className="num text-[22px]">{$(debPer)}</span>} tone={debPer ? 'bad' : undefined} sub={resPer.length ? `${pct(resPer.reduce((s, r) => s + r.presentado, 0) ? debPer / resPer.reduce((s, r) => s + r.presentado, 0) : 0, 1)} del presentado` : 'Sin lotes'} />
        <Stat label="Cobrado" value={<span className="num text-[22px]">{$(cobPer)}</span>} sub={`Plazo de pago: ${conv.plazoPagoDias} días`} />
      </div>

      <div className="mt-5">
        <Tabs label="Secciones de facturación" value={tab} onChange={setTab} tabs={[
          { id: 'produccion', label: 'Prácticas del período', count: hechos.length }, { id: 'lotes', label: 'Lotes y conciliación', count: lotesTodos.length },
          { id: 'debitos', label: 'Débitos y rechazos', count: debitosOS.length }, { id: 'convenios', label: 'Convenios y nomenclador' }]} />
      </div>

      {tab === 'produccion' && (
        <Card className="mt-4" title={`${os.nombre} · ${nombreMes(periodo)}`} subtitle="Prácticas atendidas valorizadas según el convenio"
          actions={<Button variant="primary" disabled={!sinFacturar.length} onClick={generar}><FilePlus2 size={16} /> Generar lote ({sinFacturar.length})</Button>} bodyClass="p-0">
          {hechos.length === 0 ? <Empty icon={<Receipt size={20} />} title="No hay prácticas atendidas en este período" text="Probá con otro período u otra obra social." /> : (
            <>
              <Table>
                <thead className="border-b border-line bg-slate-50"><tr><th className="th">Fecha</th><th className="th">Paciente</th><th className="th">Práctica</th><th className="th text-right">Valor convenio</th><th className="th text-right">A la OS</th><th className="th text-right">Copago</th><th className="th">Situación</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-line">
                  {hechos.slice(0, limite).map((t) => {
                    const v = valoresTurno(db, t), l = loteDeTurno(db, t.id), d = db.debitos.find((x) => x.turnoId === t.id);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70">
                        <td className="td num whitespace-nowrap">{fechaCorta(t.fecha)} {t.hora}</td>
                        <td className="td whitespace-nowrap">{nombreCompleto(idx.pac(t.pacienteId))}</td>
                        <td className="td"><span className="num mr-1.5 text-xs text-slate-500">{idx.prac(t.practicaId).codigo}</span>{idx.prac(t.practicaId).nombre}</td>
                        <td className="td num text-right">{$(v.total)}</td><td className="td num text-right font-medium">{$(v.os)}</td><td className="td num text-right text-slate-500">{$(v.copago)}</td>
                        <td className="td whitespace-nowrap">{d ? <Badge tone="red">Débito {$(d.monto)}</Badge> : l ? <Badge tone="blue">{l.id}</Badge> : <Badge tone="amber">Sin facturar</Badge>}</td>
                        <td className="td text-right">{l && !d && <Button size="sm" onClick={() => setDebitoDe(t)} title="Registrar un débito o rechazo de esta práctica">Débito</Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              {hechos.length > limite && <div className="border-t border-line p-3 text-center"><Button size="sm" onClick={() => setLimite(limite + 30)}>Mostrar más ({hechos.length - limite})</Button></div>}
            </>
          )}
        </Card>
      )}

      {tab === 'lotes' && (
        <Card className="mt-4" title={`Lotes de ${os.nombre}`} subtitle="Presentado − débitos − cobrado = saldo a cobrar" bodyClass="p-0">
          {lotesTodos.length === 0 ? <Empty icon={<Receipt size={20} />} title="Todavía no hay lotes de esta obra social" text="Generá uno desde 'Prácticas del período'." /> : (
            <Table>
              <thead className="border-b border-line bg-slate-50"><tr><th className="th">Lote</th><th className="th">Período</th><th className="th">Generado</th><th className="th text-right">Prácticas</th><th className="th text-right">Presentado</th><th className="th text-right">Débitos</th><th className="th text-right">Cobrado</th><th className="th text-right">Saldo</th><th className="th">Estado</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-line">
                {lotesTodos.map((l) => { const r = resumenLote(db, l.id); return (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="td num text-xs">{l.id}</td><td className="td">{nombreMes(l.periodo)}</td><td className="td num">{fechaDMA(l.generado)}</td><td className="td num text-right">{l.turnoIds.length}</td>
                    <td className="td num text-right">{$(r.presentado)}</td><td className="td num text-right text-red-700">{r.totalDeb ? `− ${$(r.totalDeb)}` : '—'}</td><td className="td num text-right">{$(r.cobrado)}</td><td className="td num text-right font-semibold">{$(r.saldo)}</td>
                    <td className="td"><Badge tone={r.estado === 'Conciliado' ? 'green' : r.estado === 'Cobro parcial' ? 'amber' : 'blue'}>{r.estado}</Badge></td>
                    <td className="td text-right"><Button size="sm" onClick={() => setLoteAbierto(l.id)}>Abrir</Button></td>
                  </tr>); })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'debitos' && <Debitos osId={osId} lista={debitosOS} />}
      {tab === 'convenios' && <Convenios />}

      {loteAbierto && <LoteModal loteId={loteAbierto} onClose={() => setLoteAbierto(null)} imprimir={imprimir} />}
      {debitoDe && <DebitoModal turno={debitoDe} onClose={() => setDebitoDe(null)} />}
    </>
  );
}

/* ---------- Impresión / CSV del lote ---------- */
function loteCSV(db: DB, idx: Idx, loteId: string) {
  const r = resumenLote(db, loteId);
  const rows: (string | number)[][] = [['Lote', 'Obra social', 'Período', 'Fecha práctica', 'Hora', 'Paciente (ficticio)', 'DNI', 'Afiliado', 'Código', 'Práctica', 'Valor convenio', 'Cobertura %', 'Importe a facturar', 'Copago afiliado']];
  for (const { t, p, pr, v } of filasLote(db, idx, r.turnos)) rows.push([r.lote.id, idx.os(r.lote.osId).nombre, r.lote.periodo, t.fecha, t.hora, nombreCompleto(p), p.dni, p.afiliado, pr.codigo, pr.nombre, v.total, Math.round(convenioDe(db, t.osId).cobertura * 100), v.os, v.copago]);
  return rows;
}
function LotePrint({ db, idx, loteId }: { db: DB; idx: Idx; loteId: string }) {
  const r = resumenLote(db, loteId);
  const f = filasLote(db, idx, r.turnos);
  return (
    <PrintSheet titulo={`Resumen de lote de facturación ${r.lote.id}`} subtitulo={`${idx.os(r.lote.osId).nombre} · ${nombreMes(r.lote.periodo)} · generado el ${fechaDMA(r.lote.generado)} · ${r.turnos.length} prácticas`}>
      <table>
        <thead><tr><th>Fecha</th><th>Paciente (ficticio)</th><th>Afiliado</th><th>Práctica</th><th className="r">Valor conv.</th><th className="r">A facturar</th></tr></thead>
        <tbody>{f.map(({ t, p, pr, v }) => <tr key={t.id}><td>{fechaCorta(t.fecha)}</td><td>{nombreCompleto(p)} (DNI {dniFmt(p.dni)})</td><td>{p.afiliado}</td><td>{pr.codigo} {pr.nombre}</td><td className="r">{$(v.total)}</td><td className="r">{$(v.os)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={5} className="r"><strong>Total presentado</strong></td><td className="r"><strong>{$(r.presentado)}</strong></td></tr></tfoot>
      </table>
      {r.debitos.length > 0 && (<><h1 style={{ fontSize: 14, marginTop: 14 }}>Débitos y rechazos registrados</h1><table><thead><tr><th>Fecha</th><th>Práctica</th><th>Motivo</th><th className="r">Monto</th></tr></thead><tbody>{r.debitos.map((d) => { const t = idx.turno(d.turnoId)!; return <tr key={d.id}><td>{fechaDMA(d.fecha)}</td><td>{nombreCompleto(idx.pac(t.pacienteId))} · {idx.prac(t.practicaId).codigo}</td><td>{d.motivo}</td><td className="r">{$(d.monto)}</td></tr>; })}</tbody></table></>)}
      <p style={{ marginTop: 14 }}>Presentado {$(r.presentado)} · Débitos {$(r.totalDeb)} · Cobrado {$(r.cobrado)} · <strong>Saldo a cobrar {$(r.saldo)}</strong></p>
      <p style={{ marginTop: 10, fontSize: 10, color: '#555' }}>Valores calculados con un nomenclador y convenios simulados. Pacientes ficticios.</p>
    </PrintSheet>
  );
}

function LoteModal({ loteId, onClose, imprimir }: { loteId: string; onClose: () => void; imprimir: (n: React.ReactNode) => void }) {
  const { db, addPago, patchDebito, toast } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const r = resumenLote(db, loteId);
  const [monto, setMonto] = useState('');
  const [ref, setRef] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [debitoDe, setDebitoDe] = useState<Turno | null>(null);
  const f = filasLote(db, idx, r.turnos);
  const montoN = Number(monto.replace(/\./g, '').replace(',', '.'));
  const errPago = monto && (!(montoN > 0) ? 'Ingresá un monto válido.' : montoN > r.saldo ? `El cobro supera el saldo (${$(r.saldo)}).` : '');
  const conDebito = new Set(r.debitos.map((d) => d.turnoId));

  return (
    <>
      <Modal open onClose={onClose} wide title={`Lote ${r.lote.id}`}
        footer={<>
          <Button onClick={() => { descargarCSV(`lote-${r.lote.id}.csv`, loteCSV(db, idx, loteId)); toast('CSV descargado.'); }}><Download size={15} /> CSV</Button>
          <Button onClick={() => imprimir(<LotePrint db={db} idx={idx} loteId={loteId} />)}><Printer size={15} /> Imprimir resumen</Button>
          <Button variant="primary" onClick={onClose}>Cerrar</Button></>}>
        <p className="text-sm text-slate-600">{idx.os(r.lote.osId).nombre} · {nombreMes(r.lote.periodo)} · generado el {fechaDMA(r.lote.generado)} · {r.turnos.length} prácticas</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cifra k="Presentado" v={$(r.presentado)} /><Cifra k="Débitos" v={r.totalDeb ? `− ${$(r.totalDeb)}` : $(0)} bad /><Cifra k="Cobrado" v={$(r.cobrado)} /><Cifra k="Saldo a cobrar" v={$(r.saldo)} strong />
        </div>
        <p className="mt-2 text-xs text-slate-500">Estado: <strong>{r.estado}</strong>. Copago de afiliados (no se factura a la OS): {$(r.copagos)}.</p>

        <h3 className="mb-1 mt-5 text-sm font-semibold">Conciliación de cobros</h3>
        {r.lote.pagos.length === 0 ? <p className="text-sm text-slate-500">Todavía no se registraron cobros de este lote.</p> : (
          <ul className="divide-y divide-line rounded-md border border-line text-sm">{r.lote.pagos.map((p) => <li key={p.id} className="flex justify-between gap-3 px-3 py-2"><span>{fechaDMA(p.fecha)} · {p.referencia}</span><span className="num font-medium">{$(p.monto)}</span></li>)}</ul>
        )}
        {r.saldo > 0 ? (
          <div className="mt-3 grid items-end gap-2 sm:grid-cols-[130px_1fr_150px_auto]">
            <Field label="Fecha"><input type="date" className="inp" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
            <Field label="Referencia (transferencia, cheque)"><input className="inp" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ej.: Transferencia 0014-203" /></Field>
            <Field label="Monto cobrado ($)" error={errPago || undefined}><input inputMode="decimal" className="inp num" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={String(r.saldo)} /></Field>
            <Button variant="primary" disabled={!(montoN > 0) || !!errPago} onClick={() => { addPago(loteId, { fecha, monto: montoN, referencia: ref.trim() || 'Sin referencia' }); setMonto(''); setRef(''); toast('Cobro registrado.'); }}>Registrar</Button>
          </div>
        ) : <p className="mt-2 text-sm font-medium text-emerald-800">Lote conciliado: presentado, débitos y cobros cierran en cero.</p>}

        {r.debitos.length > 0 && (<>
          <h3 className="mb-1 mt-5 text-sm font-semibold">Débitos y rechazos ({r.debitos.length})</h3>
          <ul className="divide-y divide-line rounded-md border border-line text-sm">
            {r.debitos.map((d) => { const t = idx.turno(d.turnoId)!; return (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1"><p className="font-medium">{nombreCompleto(idx.pac(t.pacienteId))} · <span className="font-normal text-slate-600">{idx.prac(t.practicaId).nombre}</span></p><p className="text-xs text-slate-500">{d.motivo} · {d.tipo === 'rechazo' ? 'Rechazo total' : 'Débito parcial'} · {fechaDMA(d.fecha)}</p></div>
                <span className="num font-medium text-red-700">{$(d.monto)}</span>
                <select aria-label="Estado del débito" className="inp !w-auto !py-1 text-xs" value={d.estado} onChange={(e) => patchDebito(d.id, { estado: e.target.value as Debito['estado'] })}>
                  <option value="abierto">Sin reclamar</option><option value="reclamado">Reclamado</option><option value="aceptado">Aceptado</option><option value="recuperado">Recuperado</option>
                </select>
              </li>); })}
          </ul></>)}

        <h3 className="mb-1 mt-5 text-sm font-semibold">Prácticas del lote</h3>
        <Table className="max-h-64 rounded-md border border-line">
          <thead className="sticky top-0 bg-slate-50"><tr><th className="th">Fecha</th><th className="th">Paciente</th><th className="th">Práctica</th><th className="th text-right">A facturar</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-line">{f.map(({ t, p, pr, v }) => (
            <tr key={t.id}><td className="td num">{fechaCorta(t.fecha)}</td><td className="td whitespace-nowrap">{nombreCompleto(p)}</td><td className="td">{pr.nombre}</td><td className="td num text-right">{$(v.os)}</td>
              <td className="td text-right">{conDebito.has(t.id) ? <Badge tone="red">Débito</Badge> : <Button size="sm" onClick={() => setDebitoDe(t)}>Débito</Button>}</td></tr>))}</tbody>
        </Table>
      </Modal>
      {debitoDe && <DebitoModal turno={debitoDe} onClose={() => setDebitoDe(null)} />}
    </>
  );
}

function Cifra({ k, v, bad, strong }: { k: string; v: string; bad?: boolean; strong?: boolean }) {
  return <div className="rounded-md bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-500">{k}</p><p className={`num text-base ${strong ? 'font-semibold' : 'font-medium'} ${bad ? 'text-red-700' : ''}`}>{v}</p></div>;
}

function DebitoModal({ turno, onClose }: { turno: Turno; onClose: () => void }) {
  const { db, addDebito, toast } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const lote = loteDeTurno(db, turno.id)!;
  const v = valoresTurno(db, turno);
  const [tipo, setTipo] = useState<'rechazo' | 'parcial'>('rechazo');
  const [motivo, setMotivo] = useState(MOTIVOS_DEBITO[0]);
  const [monto, setMonto] = useState(String(v.os));
  const m = tipo === 'rechazo' ? v.os : Number(monto.replace(',', '.'));
  const err = tipo === 'parcial' && (!(m > 0) || m > v.os) ? `El monto debe ser mayor a 0 y no superar ${$(v.os)}.` : '';
  return (
    <Modal open onClose={onClose} title="Registrar débito o rechazo"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!!err} onClick={() => { addDebito({ loteId: lote.id, turnoId: turno.id, osId: turno.osId, fecha: hoy, tipo, motivo, monto: m, estado: 'abierto' }); toast('Débito registrado.', 'info'); onClose(); }}>Registrar</Button></>}>
      <p className="mb-3 text-sm text-slate-600">{nombreCompleto(idx.pac(turno.pacienteId))} · {idx.prac(turno.practicaId).nombre} · {fechaDMA(turno.fecha)} · importe facturado {$(v.os)} (lote {lote.id})</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo"><select className="inp" value={tipo} onChange={(e) => setTipo(e.target.value as 'rechazo' | 'parcial')}><option value="rechazo">Rechazo total de la práctica</option><option value="parcial">Débito parcial</option></select></Field>
        <Field label="Monto" error={err || undefined}><input className="inp num" disabled={tipo === 'rechazo'} value={tipo === 'rechazo' ? String(v.os) : monto} onChange={(e) => setMonto(e.target.value)} /></Field>
        <Field label="Motivo" className="sm:col-span-2"><select className="inp" value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS_DEBITO.map((x) => <option key={x}>{x}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

function Debitos({ osId, lista }: { osId: string; lista: Debito[] }) {
  const { patchDebito } = useApp();
  const idx = useIdx();
  const total = lista.reduce((s, d) => s + d.monto, 0);
  const porMotivo = MOTIVOS_DEBITO.map((m) => ({ m, n: lista.filter((d) => d.motivo === m).length, s: lista.filter((d) => d.motivo === m).reduce((a, d) => a + d.monto, 0) })).filter((x) => x.n).sort((a, b) => b.s - a.s);
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2" title="Débitos y rechazos registrados" subtitle={`${idx.os(osId).nombre} · ${lista.length} registros · ${$(total)}`} bodyClass="p-0">
        {lista.length === 0 ? <Empty title="Sin débitos registrados" text="Cuando la obra social devuelva una auditoría, registrala desde el lote." /> : (
          <Table>
            <thead className="border-b border-line bg-slate-50"><tr><th className="th">Fecha</th><th className="th">Lote</th><th className="th">Paciente</th><th className="th">Motivo</th><th className="th text-right">Monto</th><th className="th">Estado</th></tr></thead>
            <tbody className="divide-y divide-line">{lista.map((d) => { const t = idx.turno(d.turnoId)!; return (
              <tr key={d.id}><td className="td num">{fechaCorta(d.fecha)}</td><td className="td num text-xs">{d.loteId}</td><td className="td whitespace-nowrap">{nombreCompleto(idx.pac(t.pacienteId))}<br /><span className="text-xs text-slate-500">{idx.prac(t.practicaId).nombre}</span></td>
                <td className="td max-w-[260px]">{d.motivo}<br /><span className="text-xs text-slate-500">{d.tipo === 'rechazo' ? 'Rechazo total' : 'Débito parcial'}</span></td><td className="td num text-right text-red-700">{$(d.monto)}</td>
                <td className="td"><select aria-label="Estado" className="inp !w-auto !py-1 text-xs" value={d.estado} onChange={(e) => patchDebito(d.id, { estado: e.target.value as Debito['estado'] })}><option value="abierto">Sin reclamar</option><option value="reclamado">Reclamado</option><option value="aceptado">Aceptado</option><option value="recuperado">Recuperado</option></select></td></tr>); })}</tbody>
          </Table>
        )}
      </Card>
      <Card title="Motivos más frecuentes" subtitle="Por importe debitado">
        {porMotivo.length === 0 ? <p className="text-sm text-slate-500">Sin datos todavía.</p> : <ul className="space-y-3">{porMotivo.map((x) => <li key={x.m} className="text-sm"><div className="flex justify-between gap-3"><span>{x.m}</span><span className="num shrink-0 font-medium">{$(x.s)}</span></div><p className="text-xs text-slate-500">{x.n} {x.n === 1 ? 'práctica' : 'prácticas'}</p></li>)}</ul>}
      </Card>
    </div>
  );
}

function Convenios() {
  const { db } = useApp();
  return (
    <div className="mt-4 space-y-4">
      <Card title="Convenios (simulados)" bodyClass="p-0">
        <Table>
          <thead className="border-b border-line bg-slate-50"><tr><th className="th">Obra social</th><th className="th text-right">Factor s/ nomenclador</th><th className="th text-right">Cobertura</th><th className="th text-right">Plazo de pago</th><th className="th">Requiere autorización</th><th className="th text-right">Vigencia aut.</th></tr></thead>
          <tbody className="divide-y divide-line">{db.convenios.map((c) => (
            <tr key={c.osId}><td className="td font-medium">{db.obras.find((o) => o.id === c.osId)!.nombre}</td><td className="td num text-right">{c.factor.toFixed(2).replace('.', ',')}</td><td className="td num text-right">{pct(c.cobertura)}</td><td className="td num text-right">{c.plazoPagoDias ? `${c.plazoPagoDias} días` : 'Contado'}</td><td className="td">{c.autModalidades.length ? c.autModalidades.map((m) => MODALIDAD_LABEL[m]).join(', ') : 'No aplica'}</td><td className="td num text-right">{c.vigenciaAutDias ? `${c.vigenciaAutDias} días` : '—'}</td></tr>))}</tbody>
        </Table>
      </Card>
      <Card title="Nomenclador simulado" subtitle="Valores base inventados; no corresponden a ningún nomenclador oficial" bodyClass="p-0">
        <Table>
          <thead className="border-b border-line bg-slate-50"><tr><th className="th">Código</th><th className="th">Práctica</th><th className="th text-right">Duración</th><th className="th text-right">Valor base</th>{db.convenios.map((c) => <th key={c.osId} className="th text-right">{db.obras.find((o) => o.id === c.osId)!.nombre.replace(' (simulado)', '').replace('Obra Social ', 'OS ')}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{db.practicas.map((p) => (
            <tr key={p.id}><td className="td num text-xs">{p.codigo}</td><td className="td">{p.nombre}</td><td className="td num text-right">{p.duracion} min</td><td className="td num text-right">{$(p.valorBase)}</td>{db.convenios.map((c) => <td key={c.osId} className="td num text-right text-slate-700">{$(Math.round((p.valorBase * c.factor) / 100) * 100)}</td>)}</tr>))}</tbody>
        </Table>
      </Card>
    </div>
  );
}
