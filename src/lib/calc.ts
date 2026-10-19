import type { Autorizacion, Convenio, DB, EstadoAut, Equipo, Practica, Turno } from '../types';
import { addDays, dow, hoyISO, toMin } from './dates';

export interface Valores { total: number; os: number; copago: number }

export const convenioDe = (db: DB, osId: string): Convenio => db.convenios.find((c) => c.osId === osId)!;

export function valoresPractica(p: Practica, c: Convenio): Valores {
  const total = Math.round((p.valorBase * c.factor) / 100) * 100;
  const os = Math.round((total * c.cobertura) / 100) * 100;
  return { total, os, copago: total - os };
}

export function valoresTurno(db: DB, t: Turno): Valores {
  const p = db.practicas.find((x) => x.id === t.practicaId)!;
  return valoresPractica(p, convenioDe(db, t.osId));
}

export function requiereAut(db: DB, osId: string, practica: Practica): boolean {
  const os = db.obras.find((o) => o.id === osId);
  if (!os || os.particular) return false;
  return convenioDe(db, osId).autModalidades.includes(practica.modalidad);
}

export function horarioEquipo(e: Equipo, fecha: string): [string, string] | null {
  const w = dow(fecha);
  if (w === 0) return null;
  if (w === 6) return e.sabado;
  return e.semana;
}

export const finTurno = (t: Pick<Turno, 'hora' | 'duracion'>) => toMin(t.hora) + t.duracion;

export const activo = (t: Turno) => t.estado !== 'cancelado';

/** Turnos que pisan el intervalo dado en el mismo equipo (ignora cancelados y el turno `excluirId`). */
export function superposiciones(db: DB, equipoId: string, fecha: string, hora: string, duracion: number, excluirId?: string): Turno[] {
  const a = toMin(hora), b = a + duracion;
  return db.turnos.filter((t) => t.id !== excluirId && t.equipoId === equipoId && t.fecha === fecha && activo(t) && toMin(t.hora) < b && finTurno(t) > a);
}

export function pacienteOcupado(db: DB, pacienteId: string, fecha: string, hora: string, duracion: number, excluirId?: string): Turno[] {
  const a = toMin(hora), b = a + duracion;
  return db.turnos.filter((t) => t.id !== excluirId && t.pacienteId === pacienteId && t.fecha === fecha && activo(t) && toMin(t.hora) < b && finTurno(t) > a);
}

export function ocupacion(db: DB, fecha: string, equipoId: string): { ocupados: number; disponibles: number; pct: number; turnos: number } {
  const e = db.equipos.find((x) => x.id === equipoId)!;
  const h = horarioEquipo(e, fecha);
  if (!h) return { ocupados: 0, disponibles: 0, pct: 0, turnos: 0 };
  const disponibles = toMin(h[1]) - toMin(h[0]);
  const ts = db.turnos.filter((t) => t.fecha === fecha && t.equipoId === equipoId && activo(t));
  const ocupados = ts.reduce((s, t) => s + t.duracion, 0);
  return { ocupados, disponibles, pct: disponibles ? Math.min(1, ocupados / disponibles) : 0, turnos: ts.length };
}

export function estadoAut(a: Autorizacion, db: DB, hoy = hoyISO()): EstadoAut {
  if (a.estado === 'autorizada' && a.vigenciaHasta && a.vigenciaHasta < hoy) {
    const t = a.turnoId ? db.turnos.find((x) => x.id === a.turnoId) : undefined;
    if (!(t && t.estado === 'atendido')) return 'vencida';
  }
  return a.estado;
}

export type AvisoAut = 'vence' | 'nocubre' | null;
/** Aviso para autorizaciones vigentes con turno por delante. */
export function avisoAut(a: Autorizacion, db: DB, hoy = hoyISO()): AvisoAut {
  if (estadoAut(a, db, hoy) !== 'autorizada' || !a.vigenciaHasta) return null;
  const t = a.turnoId ? db.turnos.find((x) => x.id === a.turnoId) : undefined;
  if (t && (t.estado === 'atendido' || t.estado === 'cancelado' || t.estado === 'ausente')) return null;
  if (t && t.fecha > a.vigenciaHasta) return 'nocubre';
  if (a.vigenciaHasta <= addDays(hoy, 5)) return 'vence';
  return null;
}

export const esFacturable = (db: DB, t: Turno) => t.estado === 'atendido' && !db.obras.find((o) => o.id === t.osId)?.particular;

export function loteDeTurno(db: DB, turnoId: string) {
  return db.lotes.find((l) => l.turnoIds.includes(turnoId));
}

export function resumenLote(db: DB, loteId: string) {
  const l = db.lotes.find((x) => x.id === loteId)!;
  const ts = l.turnoIds.map((id) => db.turnos.find((t) => t.id === id)!).filter(Boolean);
  const presentado = ts.reduce((s, t) => s + valoresTurno(db, t).os, 0);
  const copagos = ts.reduce((s, t) => s + valoresTurno(db, t).copago, 0);
  const debitos = db.debitos.filter((d) => d.loteId === loteId);
  const totalDeb = debitos.reduce((s, d) => s + d.monto, 0);
  const cobrado = l.pagos.reduce((s, p) => s + p.monto, 0);
  const saldo = presentado - totalDeb - cobrado;
  const estado = cobrado === 0 ? 'Presentado' : saldo <= 0 ? 'Conciliado' : 'Cobro parcial';
  return { lote: l, turnos: ts, presentado, copagos, debitos, totalDeb, cobrado, saldo, estado };
}

/** Insumos: consumo de un turno según su práctica. */
export function consumoDeTurno(db: DB, t: Turno) {
  const p = db.practicas.find((x) => x.id === t.practicaId)!;
  const e = db.equipos.find((x) => x.id === t.equipoId)!;
  return p.consumo.map((c) => ({ sedeId: e.sedeId, insumoId: c.insumoId, cantidad: c.cantidad }));
}

export function stockInfo(db: DB, sedeId: string, insumoId: string, hoy = hoyISO()) {
  const cfg = db.stockCfg.find((s) => s.sedeId === sedeId && s.insumoId === insumoId);
  if (!cfg) return null;
  const ingresos = db.ingresos.filter((i) => i.sedeId === sedeId && i.insumoId === insumoId).reduce((s, i) => s + i.cantidad, 0);
  let consumido = 0, consumo28 = 0, proyectado14 = 0;
  const desde = addDays(hoy, -28), hasta = addDays(hoy, 14);
  for (const t of db.turnos) {
    if (t.fecha > hasta) continue;
    const e = db.equipos.find((x) => x.id === t.equipoId)!;
    if (e.sedeId !== sedeId) continue;
    const p = db.practicas.find((x) => x.id === t.practicaId)!;
    const it = p.consumo.find((c) => c.insumoId === insumoId);
    if (!it) continue;
    if (t.estado === 'atendido') {
      consumido += it.cantidad;
      if (t.fecha >= desde) consumo28 += it.cantidad;
    } else if (t.fecha >= hoy && (t.estado === 'asignado' || t.estado === 'confirmado' || t.estado === 'enSala') && t.fecha <= hasta) {
      proyectado14 += it.cantidad;
    }
  }
  const stock = cfg.stockInicial + ingresos - consumido;
  const diario = consumo28 / 24; // ~24 días hábiles en 4 semanas
  const cobertura = diario > 0 ? stock / diario : Infinity;
  const estado: 'critico' | 'bajo' | 'ok' = stock <= cfg.minimo * 0.6 ? 'critico' : stock <= cfg.minimo ? 'bajo' : 'ok';
  return { cfg, stock, consumo28, diario, proyectado14, cobertura, estado };
}
