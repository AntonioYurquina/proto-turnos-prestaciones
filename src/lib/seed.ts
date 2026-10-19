import type { Autorizacion, Checklist, DB, Debito, EstadoTurno, IngresoInsumo, Lote, Modalidad, Paciente, Pago, Profesional, StockCfg, Turno } from '../types';
import { CONVENIOS, EQUIPOS, INSUMOS, OBRAS, PRACTICAS, PRACTICA_PESOS, SEDES } from './catalogo';
import { esFacturable, horarioEquipo, requiereAut, valoresTurno } from './calc';
import { addDays, addMeses, ahora, diffDays, fromMin, mesDe, parseISO, toISO, toMin } from './dates';

export const DB_VERSION = 4;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES_F = ['María', 'Carolina', 'Silvia', 'Graciela', 'Norma', 'Verónica', 'Andrea', 'Mónica', 'Patricia', 'Marta', 'Liliana', 'Gabriela', 'Daniela', 'Romina', 'Soledad', 'Claudia', 'Mariana', 'Noelia', 'Rosa', 'Estela', 'Ana', 'Karina', 'Florencia', 'Lorena', 'Elena', 'Cintia', 'Yamila', 'Rocío', 'Olga', 'Teresa'];
const NOMBRES_M = ['Carlos', 'Jorge', 'Roberto', 'Luis', 'Miguel', 'Héctor', 'Raúl', 'Oscar', 'Daniel', 'Ricardo', 'Marcelo', 'Fabián', 'Diego', 'Nicolás', 'Pablo', 'Sergio', 'Walter', 'Hugo', 'Alberto', 'Emilio', 'Matías', 'Julio', 'Eduardo', 'Gonzalo', 'Rubén', 'Ramón', 'Cristian', 'Ezequiel', 'Mario', 'Gerardo'];
const APELLIDOS = ['Condorí', 'Mamaní', 'Quispe', 'Choque', 'Vilte', 'Colque', 'Aramayo', 'Cruz', 'Tolaba', 'Zerpa', 'Guzmán', 'Gutiérrez', 'Flores', 'Rojas', 'Castillo', 'Ortiz', 'Sosa', 'Cabana', 'Burgos', 'Lamas', 'Ceballos', 'Villca', 'Farfán', 'Paz', 'Álvarez', 'Torres', 'Molina', 'Herrera', 'Ibarra', 'Navarro', 'Bejarano', 'Cardozo', 'Benítez', 'Ramos', 'Domínguez', 'Acosta', 'Medina', 'Pérez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Barrientos', 'Cari', 'Apaza', 'Yapura', 'Mendoza', 'Rivero', 'Leaño', 'Alancay', 'Calizaya', 'Vargas', 'Segura', 'Peralta', 'Iturralde', 'Lizárraga', 'Ontiveros'];

const MOTIVOS_RECHAZO_AUT = [
  'Falta justificación médica complementaria',
  'Práctica fuera de la cobertura del plan',
  'Cantidad de prácticas excedida en el período',
  'Orden médica incompleta',
];
export const MOTIVOS_DEBITO = [
  'Autorización vencida a la fecha de prestación',
  'Práctica sin autorización previa',
  'Falta orden médica o sin firma/sello',
  'Afiliado sin cobertura vigente',
  'Práctica duplicada en el período',
  'Código de nomenclador incorrecto',
  'Falta informe firmado',
];

function profesionales(): Profesional[] {
  const med = (id: string, nombre: string, especialidad: string, matricula: string, modalidades: Modalidad[], sedes: string[], pct: number): Profesional => ({
    id, nombre, rol: 'medico', especialidad, matricula, modalidades, sedes, esquema: { tipo: 'porcentaje', valor: pct },
  });
  const tec = (id: string, nombre: string, matricula: string, modalidades: Modalidad[], sedes: string[], monto: number): Profesional => ({
    id, nombre, rol: 'tecnico', especialidad: 'Técnico/a en diagnóstico por imágenes', matricula, modalidades, sedes, esquema: { tipo: 'porPractica', valor: monto },
  });
  return [
    med('m1', 'Dra. Marcela Iturralde', 'Diagnóstico por imágenes', 'MP 4127', ['RM', 'TC'], ['centro', 'alto'], 0.28),
    med('m2', 'Dr. Gustavo Ceballos', 'Diagnóstico por imágenes', 'MP 3984', ['RM'], ['centro'], 0.26),
    med('m3', 'Dra. Lucía Barrientos', 'Diagnóstico por imágenes', 'MP 5210', ['TC', 'MG'], ['centro', 'alto'], 0.25),
    med('m4', 'Dr. Facundo Zerpa', 'Diagnóstico por imágenes', 'MP 4653', ['TC'], ['alto', 'centro'], 0.24),
    med('m5', 'Dra. Natalia Tolaba', 'Imágenes mamarias y osteoarticulares', 'MP 4890', ['MG', 'DMO'], ['centro', 'alto'], 0.3),
    med('m6', 'Dr. Ariel Mamaní', 'Medicina nuclear', 'MP 3702', ['MN'], ['alto'], 0.32),
    med('m7', 'Dra. Cecilia Quispe', 'Medicina nuclear', 'MP 5033', ['MN', 'DMO'], ['alto'], 0.3),
    med('m8', 'Dr. Sebastián Guzmán', 'Diagnóstico por imágenes', 'MP 5377', ['RM', 'TC'], ['centro', 'alto'], 0.22),
    tec('t1', 'Leandro Cruz', 'MT 1188', ['RM'], ['centro'], 3400),
    tec('t2', 'Romina Vilte', 'MT 1241', ['TC'], ['centro'], 2900),
    tec('t3', 'Julieta Condorí', 'MT 1302', ['MG'], ['centro'], 2600),
    tec('t4', 'Marcos Aramayo', 'MT 1157', ['TC'], ['alto'], 2900),
    tec('t5', 'Diego Choque', 'MT 1276', ['MN'], ['alto'], 4200),
    tec('t6', 'Paula Lamas', 'MT 1320', ['DMO'], ['alto'], 2200),
    tec('t7', 'Hugo Burgos', 'MT 1099', ['RM', 'TC'], ['centro', 'alto'], 3100),
  ];
}

export function generarDB(): DB {
  const rng = mulberry32(20261018);
  const ri = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const pickW = <T,>(arr: [T, number][]): T => {
    const tot = arr.reduce((s, [, w]) => s + w, 0);
    let r = rng() * tot;
    for (const [v, w] of arr) { r -= w; if (r <= 0) return v; }
    return arr[0][0];
  };

  const { fecha: hoy, minutos: nowMin } = ahora();
  const profs = profesionales();

  // --- Pacientes (ficticios) ---
  const osPesos: [string, number][] = [['prov', 30], ['pami', 24], ['pa', 12], ['pb', 10], ['pc', 8], ['part', 16]];
  const pacientes: Paciente[] = [];
  const dnis = new Set<string>();
  for (let i = 0; i < 240; i++) {
    const sexo = rng() < 0.62 ? 'F' : 'M';
    const osId = pickW(osPesos);
    let dni: string;
    do { dni = String(ri(90100000, 99899999)); } while (dnis.has(dni));
    dnis.add(dni);
    const edadMin = osId === 'pami' ? 62 : 22, edadMax = osId === 'pami' ? 90 : 84;
    const nac = toISO(new Date(parseISO(hoy).getFullYear() - ri(edadMin, edadMax), ri(0, 11), ri(1, 28)));
    const tel = String(ri(100, 259)).padStart(4, '0');
    pacientes.push({
      id: `p${String(i + 1).padStart(3, '0')}`,
      nombre: pick(sexo === 'F' ? NOMBRES_F : NOMBRES_M),
      apellido: pick(APELLIDOS),
      dni, nacimiento: nac, sexo,
      telefono: `388 15-55${tel}`,
      osId,
      afiliado: osId === 'part' ? '—' : `${String(ri(100000, 999999))}/${ri(0, 4)}${ri(0, 9)}`,
    });
  }

  // --- Turnos ---
  const turnos: Turno[] = [];
  const baseFill: Record<string, number> = { rm1: 0.7, tc1: 0.66, mg1: 0.5, tc2: 0.58, mn1: 0.48, dmo1: 0.36 };
  const ocupadoPorDia = new Map<string, Set<string>>();
  let seq = 1;
  const bloqueado = (fecha: string, pid: string) => ocupadoPorDia.get(fecha)?.has(pid);
  const marcar = (fecha: string, pid: string) => {
    if (!ocupadoPorDia.has(fecha)) ocupadoPorDia.set(fecha, new Set());
    ocupadoPorDia.get(fecha)!.add(pid);
  };

  const checksVacios = (): Checklist => ({ orden: false, autorizacion: false, dni: false, credencial: false, preparacion: false });
  const checksTodos = (): Checklist => ({ orden: true, autorizacion: true, dni: true, credencial: true, preparacion: true });

  for (let d = -28; d <= 14; d++) {
    const fecha = addDays(hoy, d);
    for (const eq of EQUIPOS) {
      const h = horarioEquipo(eq, fecha);
      if (!h) continue;
      const close = toMin(h[1]);
      let cursor = toMin(h[0]);
      let fill = baseFill[eq.id];
      fill = d > 0 ? fill * Math.max(0.2, 1 - 0.052 * d) : Math.min(0.95, fill * (0.86 + rng() * 0.26));
      while (cursor + 15 <= close) {
        const lunch = cursor >= 13 * 60 && cursor < 14 * 60;
        if (rng() > (lunch ? fill * 0.55 : fill)) { cursor += pick([15, 15, 30, 30, 45]); continue; }
        const pracId = pickW(PRACTICA_PESOS[eq.modalidad]);
        const prac = PRACTICAS.find((p) => p.id === pracId)!;
        if (cursor + prac.duracion > close) { cursor += 15; continue; }
        // paciente compatible y libre ese día
        let pac: Paciente | undefined;
        for (let k = 0; k < 40; k++) {
          const c = pick(pacientes);
          if (bloqueado(fecha, c.id)) continue;
          if (eq.modalidad === 'MG' && c.sexo !== 'F') continue;
          if (eq.modalidad === 'DMO' && c.sexo === 'M' && rng() < 0.85) continue;
          pac = c; break;
        }
        if (!pac) { cursor += 15; continue; }
        marcar(fecha, pac.id);
        const medicos = profs.filter((p) => p.rol === 'medico' && p.modalidades.includes(eq.modalidad) && p.sedes.includes(eq.sedeId));
        const tecnicos = profs.filter((p) => p.rol === 'tecnico' && p.modalidades.includes(eq.modalidad) && p.sedes.includes(eq.sedeId));
        const tecnico = tecnicos.length > 1 && rng() < 0.22 ? tecnicos[1] : tecnicos[0];
        const hora = fromMin(cursor);
        const fin = cursor + prac.duracion;
        const t: Turno = {
          id: `t${String(seq++).padStart(4, '0')}`,
          fecha, hora, duracion: prac.duracion, equipoId: eq.id, pacienteId: pac.id, practicaId: prac.id, osId: pac.osId,
          profesionalId: pick(medicos).id, tecnicoId: tecnico.id, estado: 'asignado', checks: checksVacios(),
        };
        // Estado según momento
        const r = rng();
        if (d < 0 || (d === 0 && fin <= nowMin)) {
          if (r < 0.07) t.estado = 'ausente';
          else if (r < 0.125) { t.estado = 'cancelado'; t.motivoCancelacion = pick(['Cancelado por el paciente', 'Sin cobertura informada', 'Reprogramado por indicación médica']); }
          else {
            t.estado = 'atendido';
            t.checks = checksTodos();
            t.llegada = fromMin(Math.max(toMin('07:50'), cursor - ri(0, 15)));
          }
        } else if (d === 0 && cursor <= nowMin) {
          t.estado = 'enSala';
          t.checks = checksTodos();
          t.llegada = fromMin(cursor - ri(4, 14));
        } else if (d === 0 && cursor - nowMin <= 40 && rng() < 0.6) {
          t.estado = 'confirmado';
          t.llegada = fromMin(nowMin - ri(1, 22));
          t.checks = { orden: true, dni: rng() < 0.9, autorizacion: rng() < 0.6, credencial: rng() < 0.7, preparacion: rng() < 0.8 };
        } else if (r < 0.06) {
          t.estado = 'cancelado';
          t.motivoCancelacion = pick(['Cancelado por el paciente', 'Reprogramado a pedido del paciente']);
        } else {
          t.estado = rng() < (d <= 3 ? 0.78 : 0.5) ? 'confirmado' : 'asignado';
        }
        turnos.push(t);
        cursor = fin + (rng() < 0.15 ? 15 : 0);
      }
    }
  }
  turnos.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  // Asegura ausentes en la jornada de hoy para que la demo muestre todos los estados
  const atendHoy = turnos.filter((t) => t.fecha === hoy && t.estado === 'atendido' && t.hora >= '08:30');
  for (const k of [3, 9]) {
    const t = atendHoy[k];
    if (t) { t.estado = 'ausente'; t.checks = checksVacios(); t.llegada = undefined; }
  }
  // Reasignar ids ordenados para que sean estables y legibles
  turnos.forEach((t, i) => { t.id = `T-${String(i + 1).padStart(4, '0')}`; });

  // --- Autorizaciones ---
  const autorizaciones: Autorizacion[] = [];
  let aseq = 1;
  const nroAut = () => `AUT-${ri(2410000, 2699999)}`;
  for (const t of turnos) {
    const pr = PRACTICAS.find((p) => p.id === t.practicaId)!;
    const db0 = { obras: OBRAS, convenios: CONVENIOS } as unknown as DB;
    if (!requiereAut(db0, t.osId, pr)) continue;
    const conv = CONVENIOS.find((c) => c.osId === t.osId)!;
    const dd = diffDays(t.fecha, hoy);
    const a: Autorizacion = {
      id: `AU-${String(aseq++).padStart(4, '0')}`,
      pacienteId: t.pacienteId, osId: t.osId, practicaId: t.practicaId, turnoId: t.id,
      estado: 'autorizada', nro: nroAut(), solicitada: addDays(t.fecha, -ri(3, 14)),
    };
    a.vigenciaHasta = addDays(t.fecha, ri(4, conv.vigenciaAutDias - 3));
    if (dd < 0 || (dd === 0 && (t.estado === 'atendido' || t.estado === 'enSala' || t.estado === 'ausente'))) {
      if (t.estado === 'atendido' && rng() < 0.045) a.vigenciaHasta = addDays(t.fecha, -ri(1, 9));
    } else {
      const pPend = Math.min(0.32, 0.025 + 0.022 * dd);
      const r = rng();
      a.solicitada = addDays(hoy, -ri(0, 7));
      if (r < pPend) { a.estado = 'pendiente'; a.nro = undefined; a.vigenciaHasta = undefined; }
      else if (r < pPend + 0.045) { a.estado = 'rechazada'; a.nro = undefined; a.vigenciaHasta = undefined; a.motivoRechazo = pick(MOTIVOS_RECHAZO_AUT); }
      else if (r < pPend + 0.045 + 0.025 && dd > 0) a.vigenciaHasta = addDays(hoy, Math.max(1, Math.min(dd - 1, ri(1, 4))));
      else if (r < pPend + 0.045 + 0.09 && dd >= 0) a.vigenciaHasta = addDays(t.fecha, ri(0, 2));
    }
    t.autId = a.id;
    autorizaciones.push(a);
  }
  // Pedidos autorizados todavía sin turno
  for (let i = 0; i < 8; i++) {
    const pac = pick(pacientes.filter((p) => p.osId !== 'part' && p.osId !== 'pami'));
    const pr = PRACTICAS.filter((p) => ['RM', 'TC', 'MN'].includes(p.modalidad));
    const prac = pick(pr);
    autorizaciones.push({
      id: `AU-${String(aseq++).padStart(4, '0')}`, pacienteId: pac.id, osId: pac.osId, practicaId: prac.id,
      estado: i < 6 ? 'autorizada' : 'pendiente', nro: i < 6 ? nroAut() : undefined,
      solicitada: addDays(hoy, -ri(1, 9)), vigenciaHasta: i < 6 ? addDays(hoy, ri(4, 28)) : undefined,
    });
  }
  // Pedidos autorizados que se vencieron sin llegar a usarse
  for (let i = 0; i < 4; i++) {
    const pac = pick(pacientes.filter((p) => p.osId !== 'part' && p.osId !== 'pami'));
    const prac = pick(PRACTICAS.filter((p) => ['RM', 'TC'].includes(p.modalidad)));
    autorizaciones.push({
      id: `AU-${String(aseq++).padStart(4, '0')}`, pacienteId: pac.id, osId: pac.osId, practicaId: prac.id,
      estado: 'autorizada', nro: nroAut(), solicitada: addDays(hoy, -ri(25, 40)), vigenciaHasta: addDays(hoy, -ri(1, 12)),
    });
  }

  // --- Lotes, débitos, pagos ---
  const base: DB = {
    version: DB_VERSION, seedDate: hoy, sedes: SEDES, equipos: EQUIPOS, obras: OBRAS, convenios: CONVENIOS, practicas: PRACTICAS,
    insumos: INSUMOS, stockCfg: [], ingresos: [], profesionales: profs, pacientes, turnos, autorizaciones, lotes: [], debitos: [],
  };
  const lotes: Lote[] = [];
  const debitos: Debito[] = [];
  const periodoPrev = addMeses(mesDe(hoy), -1);
  const generado = (() => { const g = addDays(`${addMeses(periodoPrev, 1)}-01`, 2); return g > hoy ? hoy : g; })();
  let lseq = 1, dseq = 1, pseq = 1;
  for (const os of OBRAS.filter((o) => !o.particular)) {
    const ts = turnos.filter((t) => t.osId === os.id && mesDe(t.fecha) === periodoPrev && esFacturable(base, t));
    if (!ts.length) continue;
    const lote: Lote = { id: `L-${periodoPrev.replace('-', '')}-${String(lseq++).padStart(2, '0')}`, osId: os.id, periodo: periodoPrev, generado, turnoIds: ts.map((t) => t.id), pagos: [] };
    lotes.push(lote);
    for (const t of ts) {
      const au = autorizaciones.find((a) => a.id === t.autId);
      const vencida = au && au.vigenciaHasta && au.vigenciaHasta < t.fecha;
      if (!vencida && rng() > 0.06) continue;
      const fechaD = addDays(generado, ri(10, 22));
      if (fechaD > hoy) continue;
      const os$ = valoresTurno(base, t).os;
      const tipo = vencida || rng() < 0.6 ? 'rechazo' : 'parcial';
      debitos.push({
        id: `D-${String(dseq++).padStart(3, '0')}`, loteId: lote.id, turnoId: t.id, osId: os.id, fecha: fechaD, tipo,
        motivo: vencida ? MOTIVOS_DEBITO[0] : pick(MOTIVOS_DEBITO.slice(1)),
        monto: tipo === 'rechazo' ? os$ : Math.round((os$ * (0.2 + rng() * 0.3)) / 100) * 100,
        estado: pick(['abierto', 'reclamado', 'reclamado', 'aceptado'] as const),
      });
    }
  }
  base.lotes = lotes; base.debitos = debitos;
  // pagos: Prepaga A paga todo el neto; Prepaga B el 50 %
  for (const l of lotes) {
    const pres = l.turnoIds.reduce((s, id) => s + valoresTurno(base, turnos.find((t) => t.id === id)!).os, 0);
    const deb = debitos.filter((d) => d.loteId === l.id).reduce((s, d) => s + d.monto, 0);
    const f = addDays(l.generado, 14);
    if (f > hoy) continue;
    const pago = (monto: number, ref: string): Pago => ({ id: `PG-${String(pseq++).padStart(3, '0')}`, fecha: f, monto, referencia: ref });
    if (l.osId === 'pa') l.pagos.push(pago(pres - deb, 'Transferencia 0013-884'));
    if (l.osId === 'pb') l.pagos.push(pago(Math.round(((pres - deb) * 0.5) / 100) * 100, 'Transferencia 0013-912 (pago parcial)'));
  }

  // --- Stock de insumos (derivado de consumo + ingresos) ---
  const stockCfg: StockCfg[] = [];
  const ingresos: IngresoInsumo[] = [];
  const consumido: Record<string, number> = {};
  for (const t of turnos) {
    if (t.estado !== 'atendido') continue;
    const e = EQUIPOS.find((x) => x.id === t.equipoId)!;
    for (const c of PRACTICAS.find((p) => p.id === t.practicaId)!.consumo) {
      const k = `${e.sedeId}|${c.insumoId}`;
      consumido[k] = (consumido[k] ?? 0) + c.cantidad;
    }
  }
  const forzados: Record<string, number> = { 'centro|gad': 0.7, 'alto|tc99': 0.92, 'alto|iod': 1.25, 'centro|iod': 1.1 };
  const provs = ['Droguería Norandina (ficticia)', 'Distribuidora Médica del Valle (ficticia)', 'Insumos Hospitalarios NOA (ficticia)'];
  let iseq = 1;
  for (const k of Object.keys(consumido).sort()) {
    const [sedeId, insumoId] = k.split('|');
    const total = consumido[k];
    const diario = total / 24;
    const minimo = Math.max(2, Math.ceil(diario * 7));
    const factor = forzados[k] ?? 1.7 + rng() * 2.2;
    const final = Math.round(minimo * factor);
    const nIng = insumoId === 'tc99' ? 6 : ri(2, 3);
    let sumIng = 0;
    for (let i = 0; i < nIng; i++) {
      const cant = Math.max(1, Math.round((total * 0.8) / nIng));
      sumIng += cant;
      ingresos.push({
        id: `IN-${String(iseq++).padStart(3, '0')}`, fecha: addDays(hoy, -Math.round(((i + 0.5) * 26) / nIng) - ri(0, 1)), sedeId, insumoId, cantidad: cant,
        remito: `0004-${String(ri(10000, 99999)).padStart(8, '0')}`, proveedor: insumoId === 'tc99' ? 'Radiofarmacia Central (ficticia)' : pick(provs),
      });
    }
    stockCfg.push({ sedeId, insumoId, minimo, stockInicial: Math.round(total - sumIng + final) });
  }
  base.stockCfg = stockCfg;
  base.ingresos = ingresos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return base;
}

export const ESTADOS_ORDEN: EstadoTurno[] = ['asignado', 'confirmado', 'enSala', 'atendido', 'ausente', 'cancelado'];
