import { useMemo, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { useApp } from '../store';
import { useIdx } from '../lib/index';
import { ahora, fechaDMA } from '../lib/dates';
import { stockInfo } from '../lib/calc';
import { $, n1 } from '../lib/format';
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Stat, Table } from '../components/ui';

export default function Insumos() {
  const { db, sede, addIngreso, toast } = useApp();
  const idx = useIdx();
  const hoy = ahora().fecha;
  const [ing, setIng] = useState<{ sedeId?: string; insumoId?: string } | null>(null);

  const filas = useMemo(() => db.stockCfg.filter((c) => sede === 'todas' || c.sedeId === sede).map((c) => ({ c, s: stockInfo(db, c.sedeId, c.insumoId, hoy)!, ins: db.insumos.find((i) => i.id === c.insumoId)! }))
    .sort((a, b) => a.c.sedeId.localeCompare(b.c.sedeId) || ({ critico: 0, bajo: 1, ok: 2 }[a.s.estado] - { critico: 0, bajo: 1, ok: 2 }[b.s.estado]) || a.ins.nombre.localeCompare(b.ins.nombre)), [db, sede, hoy]);
  const bajos = filas.filter((f) => f.s.estado !== 'ok');
  const valor = filas.reduce((s, f) => s + Math.max(0, f.s.stock) * f.ins.costo, 0);
  const ingresos = db.ingresos.filter((i) => sede === 'todas' || i.sedeId === sede).slice(0, 8);

  return (
    <>
      <PageHeader title="Insumos" subtitle="Stock por sede calculado desde los ingresos y el consumo estimado de cada estudio atendido. Los costos son ilustrativos."
        actions={<Button variant="primary" onClick={() => setIng({})}><PackagePlus size={16} /> Registrar ingreso</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ítems en seguimiento" value={filas.length} />
        <Stat label="Para reponer" value={bajos.length} tone={bajos.length ? 'warn' : 'good'} sub={`${bajos.filter((b) => b.s.estado === 'critico').length} en nivel crítico`} />
        <Stat label="Stock valorizado" value={<span className="num text-[22px]">{$(valor)}</span>} sub="A costo ilustrativo" />
        <Stat label="Ingresos (28 días)" value={db.ingresos.filter((i) => sede === 'todas' || i.sedeId === sede).length} sub="Remitos cargados" />
      </div>

      <Card className="mt-4" title="Stock y reposición" subtitle="Cobertura = stock ÷ consumo diario promedio de las últimas 4 semanas" bodyClass="p-0">
        {filas.length === 0 ? <Empty title="Sin insumos para esta sede" /> : (
          <Table>
            <thead className="border-b border-line bg-slate-50"><tr><th className="th">Sede</th><th className="th">Insumo</th><th className="th text-right">Stock</th><th className="th text-right">Mínimo</th><th className="th text-right">Cobertura</th><th className="th text-right">Consumo 28 d</th><th className="th text-right">Agenda 14 d</th><th className="th">Estado</th><th className="th text-right">Sugerido</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-line">
              {filas.map(({ c, s, ins }) => {
                const sug = Math.max(0, Math.ceil(s.proyectado14 + c.minimo - s.stock));
                return (
                  <tr key={`${c.sedeId}${c.insumoId}`} className="hover:bg-slate-50/70">
                    <td className="td whitespace-nowrap text-slate-600">{idx.sede(c.sedeId).corto}</td>
                    <td className="td font-medium">{ins.nombre}</td>
                    <td className="td num text-right font-semibold">{n1(s.stock)} <span className="text-xs font-normal text-slate-500">{ins.unidad}</span></td>
                    <td className="td num text-right text-slate-500">{c.minimo}</td>
                    <td className="td num text-right">{isFinite(s.cobertura) ? `${Math.max(0, Math.floor(s.cobertura))} días` : '—'}</td>
                    <td className="td num text-right text-slate-600">{n1(s.consumo28)}</td>
                    <td className="td num text-right text-slate-600">{n1(s.proyectado14)}</td>
                    <td className="td"><Badge tone={s.estado === 'critico' ? 'red' : s.estado === 'bajo' ? 'amber' : 'green'}>{s.estado === 'critico' ? 'Crítico' : s.estado === 'bajo' ? 'Reponer' : 'Normal'}</Badge></td>
                    <td className="td num text-right">{s.estado !== 'ok' ? <strong>{sug} {ins.unidad}</strong> : <span className="text-slate-400">—</span>}</td>
                    <td className="td text-right"><Button size="sm" variant={s.estado !== 'ok' ? 'primary' : 'secondary'} onClick={() => setIng({ sedeId: c.sedeId, insumoId: c.insumoId })}>Ingreso</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Consumo estimado por práctica" subtitle="Cantidad que descuenta cada estudio atendido" bodyClass="p-0">
          <Table>
            <thead className="border-b border-line bg-slate-50"><tr><th className="th">Práctica</th>{db.insumos.map((i) => <th key={i.id} className="th text-right" title={i.nombre}>{i.nombre.split(' (')[0].replace('Contraste ', 'Contr. ').replace('Radiofármaco ', '')}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{db.practicas.map((p) => (
              <tr key={p.id}><td className="td whitespace-nowrap">{p.nombre}</td>{db.insumos.map((i) => { const c = p.consumo.find((x) => x.insumoId === i.id); return <td key={i.id} className="td num text-right text-slate-700">{c ? c.cantidad : <span className="text-slate-300">·</span>}</td>; })}</tr>))}</tbody>
          </Table>
        </Card>
        <Card title="Últimos ingresos" bodyClass="p-0">
          {ingresos.length === 0 ? <Empty title="Sin ingresos cargados" /> : (
            <ul className="divide-y divide-line">{ingresos.map((i) => (
              <li key={i.id} className="px-4 py-2.5 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{db.insumos.find((x) => x.id === i.insumoId)!.nombre.split(' (')[0]}</span><span className="num">+{i.cantidad}</span></div><p className="text-xs text-slate-500">{fechaDMA(i.fecha)} · {idx.sede(i.sedeId).corto} · remito {i.remito}</p></li>))}</ul>
          )}
        </Card>
      </div>

      {ing && <IngresoModal ini={ing} onClose={() => setIng(null)} onSave={(x) => { addIngreso(x); toast('Ingreso de insumos registrado.'); setIng(null); }} />}
    </>
  );
}

function IngresoModal({ ini, onClose, onSave }: { ini: { sedeId?: string; insumoId?: string }; onClose: () => void; onSave: (x: { fecha: string; sedeId: string; insumoId: string; cantidad: number; remito: string; proveedor: string }) => void }) {
  const { db, sede } = useApp();
  const [sedeId, setSedeId] = useState(ini.sedeId ?? (sede !== 'todas' ? sede : db.sedes[0].id));
  const disp = db.stockCfg.filter((c) => c.sedeId === sedeId);
  const [insumoId, setInsumoId] = useState(ini.insumoId ?? disp[0]?.insumoId ?? '');
  const [cant, setCant] = useState('');
  const [remito, setRemito] = useState('');
  const [prov, setProv] = useState('');
  const [fecha, setFecha] = useState(ahora().fecha);
  const n = Number(cant.replace(',', '.'));
  const ins = db.insumos.find((i) => i.id === insumoId);
  const err = cant && !(n > 0) ? 'Ingresá una cantidad mayor a cero.' : '';
  const insumoValido = disp.some((d) => d.insumoId === insumoId);
  return (
    <Modal open onClose={onClose} title="Registrar ingreso de insumos"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!(n > 0) || !remito.trim() || !insumoValido} onClick={() => onSave({ fecha, sedeId, insumoId, cantidad: n, remito: remito.trim(), proveedor: prov.trim() || 'Sin especificar' })}>Guardar ingreso</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sede"><select className="inp" value={sedeId} onChange={(e) => { setSedeId(e.target.value); const d = db.stockCfg.find((c) => c.sedeId === e.target.value); if (d && !db.stockCfg.some((c) => c.sedeId === e.target.value && c.insumoId === insumoId)) setInsumoId(d.insumoId); }}>{db.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></Field>
        <Field label="Insumo"><select className="inp" value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>{disp.map((c) => <option key={c.insumoId} value={c.insumoId}>{db.insumos.find((i) => i.id === c.insumoId)!.nombre}</option>)}</select></Field>
        <Field label={`Cantidad${ins ? ` (${ins.unidad})` : ''}`} error={err || undefined}><input inputMode="decimal" className="inp num" value={cant} onChange={(e) => setCant(e.target.value)} /></Field>
        <Field label="Fecha de ingreso"><input type="date" className="inp" value={fecha} max={ahora().fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <Field label="Nº de remito"><input className="inp num" value={remito} onChange={(e) => setRemito(e.target.value)} placeholder="0004-00012345" /></Field>
        <Field label="Proveedor"><input className="inp" value={prov} onChange={(e) => setProv(e.target.value)} placeholder="Nombre del proveedor" /></Field>
      </div>
    </Modal>
  );
}
