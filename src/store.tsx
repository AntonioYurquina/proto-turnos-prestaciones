import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Autorizacion, Checklist, DB, Debito, Esquema, EstadoTurno, IngresoInsumo, Lote, Pago, Turno } from './types';
import { DB_VERSION, generarDB } from './lib/seed';
import { esFacturable, loteDeTurno } from './lib/calc';
import { ahora, mesDe } from './lib/dates';

const KEY = 'cuadrante.db';
const KEY_SEDE = 'cuadrante.sede';

function cargar(): DB {
  const hoy = ahora().fecha;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as DB;
      // Los datos de ejemplo son relativos a la fecha: si cambió el día o la versión, se regeneran.
      if (d.version === DB_VERSION && d.seedDate === hoy) return d;
    }
  } catch { /* sin almacenamiento disponible */ }
  return generarDB();
}

interface Toast { id: number; msg: string; tipo: 'ok' | 'error' | 'info' }

interface Ctx {
  db: DB;
  sede: string;
  setSede: (s: string) => void;
  toast: (msg: string, tipo?: Toast['tipo']) => void;
  toasts: Toast[];
  imprimir: (nodo: ReactNode) => void;
  printNode: ReactNode | null;
  reset: () => void;
  addTurno: (t: Omit<Turno, 'id' | 'checks'>, crearAut: boolean) => Turno;
  patchTurno: (id: string, patch: Partial<Turno>, log?: string) => void;
  setEstado: (id: string, e: EstadoTurno, motivo?: string) => void;
  checkIn: (id: string, hora: string) => void;
  setCheck: (id: string, k: keyof Checklist, v: boolean) => void;
  addAut: (a: Omit<Autorizacion, 'id'>) => Autorizacion;
  patchAut: (id: string, patch: Partial<Autorizacion>) => void;
  generarLote: (osId: string, periodo: string, hoy: string) => Lote | null;
  addDebito: (d: Omit<Debito, 'id'>) => void;
  patchDebito: (id: string, patch: Partial<Debito>) => void;
  addPago: (loteId: string, p: Omit<Pago, 'id'>) => void;
  setEsquema: (profId: string, e: Esquema) => void;
  addIngreso: (i: Omit<IngresoInsumo, 'id'>) => void;
}

const C = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(C);

let uid = Date.now() % 100000;
const nuevoId = (pref: string) => `${pref}${(uid++).toString(36).toUpperCase()}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(cargar);
  const [sede, setSedeS] = useState<string>(() => { try { return localStorage.getItem(KEY_SEDE) || 'todas'; } catch { return 'todas'; } });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [printNode, setPrintNode] = useState<ReactNode | null>(null);
  const tid = useRef(1);
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* cuota o modo privado */ }
  }, [db]);

  const setSede = useCallback((s: string) => {
    setSedeS(s);
    try { localStorage.setItem(KEY_SEDE, s); } catch { /* noop */ }
  }, []);

  const toast = useCallback((msg: string, tipo: Toast['tipo'] = 'ok') => {
    const id = tid.current++;
    setToasts((t) => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const imprimir = useCallback((nodo: ReactNode) => {
    setPrintNode(nodo);
    setTimeout(() => {
      window.print();
    }, 150);
  }, []);
  useEffect(() => {
    const f = () => setPrintNode(null);
    window.addEventListener('afterprint', f);
    return () => window.removeEventListener('afterprint', f);
  }, []);

  const value = useMemo<Ctx>(() => {
    const upd = (fn: (d: DB) => DB) => setDb((d) => fn(d));
    const mapTurno = (id: string, fn: (t: Turno) => Turno) => upd((d) => ({ ...d, turnos: d.turnos.map((t) => (t.id === id ? fn(t) : t)) }));
    const stamp = () => { const a = ahora(); return `${String(Math.floor(a.minutos / 60)).padStart(2, '0')}:${String(a.minutos % 60).padStart(2, '0')}`; };
    return {
      db, sede, setSede, toast, toasts, imprimir, printNode,
      reset: () => { try { localStorage.removeItem(KEY); } catch { /* noop */ } setDb(generarDB()); toast('Se restablecieron los datos de ejemplo.', 'info'); },
      addTurno: (t, crearAut) => {
        const turno: Turno = { ...t, id: nuevoId('T-'), checks: { orden: false, autorizacion: false, dni: false, credencial: false, preparacion: false }, log: [`${stamp()} Turno creado`] };
        let nueva: Autorizacion | null = null;
        if (crearAut && !turno.autId) {
          nueva = { id: nuevoId('AU-'), pacienteId: turno.pacienteId, osId: turno.osId, practicaId: turno.practicaId, turnoId: turno.id, estado: 'pendiente', solicitada: ahora().fecha };
          turno.autId = nueva.id;
        }
        upd((d) => ({
          ...d,
          turnos: [...d.turnos, turno],
          autorizaciones: nueva ? [...d.autorizaciones, nueva] : d.autorizaciones.map((a) => (a.id === turno.autId ? { ...a, turnoId: turno.id } : a)),
        }));
        return turno;
      },
      patchTurno: (id, patch, log) => mapTurno(id, (t) => ({ ...t, ...patch, log: log ? [...(t.log ?? []), `${stamp()} ${log}`] : t.log })),
      setEstado: (id, e, motivo) => mapTurno(id, (t) => ({
        ...t, estado: e, motivoCancelacion: e === 'cancelado' ? motivo : t.motivoCancelacion,
        log: [...(t.log ?? []), `${stamp()} Estado: ${e}${motivo ? ` (${motivo})` : ''}`],
      })),
      checkIn: (id, hora) => mapTurno(id, (t) => ({ ...t, llegada: hora, estado: t.estado === 'asignado' ? 'confirmado' : t.estado, log: [...(t.log ?? []), `${hora} Check-in en recepción`] })),
      setCheck: (id, k, v) => mapTurno(id, (t) => ({ ...t, checks: { ...t.checks, [k]: v } })),
      addAut: (a) => {
        const aut: Autorizacion = { ...a, id: nuevoId('AU-') };
        upd((d) => ({ ...d, autorizaciones: [...d.autorizaciones, aut], turnos: d.turnos.map((t) => (aut.turnoId && t.id === aut.turnoId ? { ...t, autId: aut.id } : t)) }));
        return aut;
      },
      patchAut: (id, patch) => upd((d) => ({ ...d, autorizaciones: d.autorizaciones.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      generarLote: (osId, periodo, hoy) => {
        const d = dbRef.current;
        const ya = new Set(d.lotes.flatMap((l) => l.turnoIds));
        const ts = d.turnos.filter((t) => t.osId === osId && mesDe(t.fecha) === periodo && esFacturable(d, t) && !ya.has(t.id));
        if (!ts.length) return null;
        const n = d.lotes.filter((l) => l.osId === osId && l.periodo === periodo).length + 1;
        const lote: Lote = { id: `L-${periodo.replace('-', '')}-${osId.toUpperCase()}-${n}`, osId, periodo, generado: hoy, turnoIds: ts.map((t) => t.id), pagos: [] };
        upd((x) => ({ ...x, lotes: [...x.lotes, lote] }));
        return lote;
      },
      addDebito: (x) => upd((d) => ({ ...d, debitos: [...d.debitos, { ...x, id: nuevoId('D-') }] })),
      patchDebito: (id, patch) => upd((d) => ({ ...d, debitos: d.debitos.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      addPago: (loteId, p) => upd((d) => ({ ...d, lotes: d.lotes.map((l) => (l.id === loteId ? { ...l, pagos: [...l.pagos, { ...p, id: nuevoId('PG-') }] } : l)) })),
      setEsquema: (profId, e) => upd((d) => ({ ...d, profesionales: d.profesionales.map((p) => (p.id === profId ? { ...p, esquema: e } : p)) })),
      addIngreso: (i) => upd((d) => ({ ...d, ingresos: [{ ...i, id: nuevoId('IN-') }, ...d.ingresos] })),
    };
  }, [db, sede, setSede, toast, toasts, imprimir, printNode]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export { loteDeTurno };
