import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, CalendarDays, ClipboardCheck, FileCheck2, LayoutDashboard, Menu, PackageOpen, BarChart3, RotateCcw, Stethoscope, X, CheckCircle2, AlertCircle, Info, ConciergeBell } from 'lucide-react';
import { config } from './config';
import { useApp } from './store';
import { Button, Modal, cx } from './components/ui';
import { ahora, fechaLarga } from './lib/dates';
import { estadoAut } from './lib/calc';
import Tablero from './pages/Tablero';
import Agenda from './pages/Agenda';
import Recepcion from './pages/Recepcion';
import Autorizaciones from './pages/Autorizaciones';
import Facturacion from './pages/Facturacion';
import Honorarios from './pages/Honorarios';
import Insumos from './pages/Insumos';
import Reportes from './pages/Reportes';

const RUTAS = [
  { id: 'tablero', label: 'Tablero', icon: LayoutDashboard, el: <Tablero /> },
  { id: 'agenda', label: 'Agenda de turnos', icon: CalendarDays, el: <Agenda /> },
  { id: 'recepcion', label: 'Recepción', icon: ConciergeBell, el: <Recepcion /> },
  { id: 'autorizaciones', label: 'Autorizaciones', icon: FileCheck2, el: <Autorizaciones /> },
  { id: 'facturacion', label: 'Facturación', icon: Banknote, el: <Facturacion /> },
  { id: 'honorarios', label: 'Honorarios', icon: Stethoscope, el: <Honorarios /> },
  { id: 'insumos', label: 'Insumos', icon: PackageOpen, el: <Insumos /> },
  { id: 'reportes', label: 'Reportes', icon: BarChart3, el: <Reportes /> },
] as const;

function useHash() {
  const get = () => (window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'tablero');
  const [h, setH] = useState(get);
  useEffect(() => {
    const f = () => { setH(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

export default function App() {
  const ruta = useHash();
  const { db, sede, setSede, reset, toasts, printNode } = useApp();
  const [menu, setMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const actual = RUTAS.find((r) => r.id === ruta) ?? RUTAS[0];
  const hoy = ahora();

  useEffect(() => { document.title = `${actual.label} · ${config.producto}`; setMenu(false); }, [actual.label]);

  const badges = useMemo(() => {
    const pend = db.autorizaciones.filter((a) => estadoAut(a, db, hoy.fecha) === 'pendiente' && (!a.turnoId || (db.turnos.find((t) => t.id === a.turnoId)?.fecha ?? '') >= hoy.fecha)).length;
    const espera = db.turnos.filter((t) => t.fecha === hoy.fecha && t.llegada && (t.estado === 'confirmado' || t.estado === 'asignado')).length;
    return { autorizaciones: pend, recepcion: espera } as Record<string, number>;
  }, [db, hoy.fecha]);

  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-0.5 px-3">
      {RUTAS.map((r) => {
        const Icon = r.icon;
        const on = r.id === actual.id;
        return (
          <a key={r.id} href={`#/${r.id}`} aria-current={on ? 'page' : undefined}
            className={cx('group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors', on ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
            <Icon size={17} className={on ? 'text-brand-200' : 'text-slate-400 group-hover:text-slate-200'} />
            <span className="flex-1">{r.label}</span>
            {badges[r.id] > 0 && <span className="rounded-full bg-amber-400/20 px-1.5 text-[11px] font-semibold text-amber-200">{badges[r.id]}</span>}
          </a>
        );
      })}
    </nav>
  );

  const side = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-5">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="11" height="11" rx="2" fill="#12877e" /><rect x="18" y="3" width="11" height="11" rx="2" fill="#9bd1cb" /><rect x="3" y="18" width="11" height="11" rx="2" fill="#9bd1cb" /><rect x="18" y="18" width="11" height="11" rx="2" fill="#12877e" /></svg>
          <div className="leading-tight">
            <p className="text-[17px] font-semibold tracking-tight text-white">{config.producto}</p>
            <p className="text-[11px] text-slate-400">Turnos y prestaciones</p>
          </div>
        </div>
      </div>
      {nav}
      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-md border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-slate-300">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-200"><AlertCircle size={13} /> Datos 100 % ficticios</p>
          Pacientes, profesionales, obras sociales y valores son inventados. No cargue datos reales.
        </div>
        <button type="button" onClick={() => setConfirmReset(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">
          <RotateCcw size={14} /> Restablecer datos de ejemplo
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div id="app-root" className="min-h-screen">
        <div className="relative z-30 flex items-center justify-between gap-3 bg-ink-950 px-4 py-1.5 text-[11px] text-slate-300">
          <span>Prototipo preparado para <strong className="font-semibold text-white">{config.preparadoPara}</strong></span>
          <span className="hidden text-slate-400 sm:inline">Demostración con datos ficticios · sin backend</span>
        </div>
        {menu && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
            <div className="absolute inset-0 bg-ink-950/60" onClick={() => setMenu(false)} />
            <div className="absolute bottom-0 left-0 top-0 w-72 max-w-[85vw] overflow-y-auto bg-ink-900">
              <button type="button" aria-label="Cerrar menú" onClick={() => setMenu(false)} className="absolute right-3 top-3 rounded p-1 text-slate-300 hover:bg-white/10"><X size={18} /></button>
              {side}
            </div>
          </div>
        )}
        <div className="lg:flex">
        <aside className="hidden w-60 shrink-0 bg-ink-900 lg:block"><div className="sticky top-0 h-screen overflow-y-auto">{side}</div></aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur lg:px-8">
            <button type="button" aria-label="Abrir menú" onClick={() => setMenu(true)} className="rounded-md p-1.5 text-ink-800 hover:bg-slate-200/70 lg:hidden"><Menu size={20} /></button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900 lg:hidden">{actual.label}</p>
              <p className="hidden items-center gap-2 text-sm text-slate-600 lg:flex">
                <ClipboardCheck size={15} className="text-brand-600" />
                {fechaLarga(hoy.fecha)}
              </p>
            </div>
            <div role="group" aria-label="Filtrar por sede" className="flex w-full rounded-md bg-slate-200/70 p-0.5 text-xs font-medium sm:w-auto">
              {[{ id: 'todas', n: 'Ambas sedes' }, ...db.sedes.map((s) => ({ id: s.id, n: s.corto }))].map((s) => (
                <button key={s.id} type="button" aria-pressed={sede === s.id} onClick={() => setSede(s.id)}
                  className={cx('flex-1 rounded px-2.5 py-1.5 transition-colors sm:flex-none', sede === s.id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600 hover:text-ink-900')}>{s.n}</button>
              ))}
            </div>
          </header>
          <main className="px-4 pb-16 pt-6 lg:px-8">{actual.el}</main>
          <footer className="px-4 pb-8 text-xs text-slate-500 lg:px-8">
            {config.producto} · prototipo funcional. Todos los pacientes, profesionales, obras sociales, nomencladores y valores son ficticios. No incluye diagnósticos clínicos.
          </footer>
        </div>
        </div>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-md bg-ink-900 px-3.5 py-2.5 text-sm text-white shadow-lg">
            {t.tipo === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" /> : t.tipo === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-300" /> : <Info size={16} className="mt-0.5 shrink-0 text-sky-300" />}
            {t.msg}
          </div>
        ))}
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Restablecer datos de ejemplo"
        footer={<><Button onClick={() => setConfirmReset(false)}>Cancelar</Button><Button variant="primary" onClick={() => { reset(); setConfirmReset(false); }}>Restablecer</Button></>}>
        <p className="text-sm text-slate-700">Se descartan todos los cambios hechos en este navegador (turnos, autorizaciones, lotes, ingresos) y se vuelven a generar los datos ficticios a partir de la fecha de hoy.</p>
      </Modal>

      {printNode && createPortal(<div id="print-root">{printNode as ReactNode}</div>, document.body)}
    </>
  );
}
