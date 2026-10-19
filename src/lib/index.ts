import { useMemo } from 'react';
import type { Autorizacion, DB, Equipo, ObraSocial, Paciente, Practica, Profesional, Sede, Turno } from '../types';
import { useApp } from '../store';

export function makeIndex(db: DB) {
  const m = <T extends { id: string }>(a: T[]) => new Map(a.map((x) => [x.id, x]));
  const pacs = m(db.pacientes), pracs = m(db.practicas), eqs = m(db.equipos), oss = m(db.obras), profs = m(db.profesionales), sedes = m(db.sedes), auts = m(db.autorizaciones), turnos = m(db.turnos);
  return {
    pac: (id: string) => pacs.get(id) as Paciente,
    prac: (id: string) => pracs.get(id) as Practica,
    eq: (id: string) => eqs.get(id) as Equipo,
    os: (id: string) => oss.get(id) as ObraSocial,
    prof: (id: string) => profs.get(id) as Profesional,
    sede: (id: string) => sedes.get(id) as Sede,
    aut: (id?: string) => (id ? (auts.get(id) as Autorizacion | undefined) : undefined),
    turno: (id: string) => turnos.get(id) as Turno | undefined,
  };
}
export type Idx = ReturnType<typeof makeIndex>;

export function useIdx() {
  const { db } = useApp();
  return useMemo(() => makeIndex(db), [db]);
}

/** Equipos visibles según el filtro de sede global. */
export function useEquipos() {
  const { db, sede } = useApp();
  return useMemo(() => db.equipos.filter((e) => sede === 'todas' || e.sedeId === sede), [db.equipos, sede]);
}

export const WA = (tel: string, msg: string) => {
  const d = tel.replace(/\D/g, '').replace(/^38815/, '');
  return `https://wa.me/549388${d}?text=${encodeURIComponent(msg)}`;
};
