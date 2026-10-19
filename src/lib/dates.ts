export const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso: string, n: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a: string, b: string) => Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
export const dow = (iso: string) => parseISO(iso).getDay(); // 0 = domingo
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const mesDe = (iso: string) => iso.slice(0, 7);
export const addMeses = (periodo: string, n: number) => {
  const [y, m] = periodo.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

/**
 * "Hoy" del prototipo. Es la fecha real (new Date()), salvo que caiga en fin de semana:
 * en ese caso se usa el lunes siguiente para que la demo siempre tenga jornada con turnos.
 * Fuera del horario de atención (08:00-18:00) se simula las 11:20 para que haya sala de espera.
 */
export function ahora(): { fecha: string; minutos: number; simulado: boolean } {
  const n = new Date();
  let fecha = toISO(n);
  const w = n.getDay();
  let simulado = false;
  if (w === 0) { fecha = addDays(fecha, 1); simulado = true; }
  if (w === 6) { fecha = addDays(fecha, 2); simulado = true; }
  let minutos = n.getHours() * 60 + n.getMinutes();
  if (simulado || minutos < 8 * 60 + 15 || minutos > 18 * 60) {
    minutos = 11 * 60 + 20;
    simulado = true;
  }
  return { fecha, minutos, simulado };
}
export const hoyISO = () => ahora().fecha;

const fmtLargo = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtCorto = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });
const fmtDiaCorto = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric' });
const fmtMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fechaLarga = (iso: string) => cap(fmtLargo.format(parseISO(iso)));
export const fechaCorta = (iso: string) => fmtCorto.format(parseISO(iso));
export const fechaDMA = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
export const diaCorto = (iso: string) => cap(fmtDiaCorto.format(parseISO(iso)).replace('.', ''));
export const nombreMes = (periodo: string) => cap(fmtMes.format(parseISO(`${periodo}-01`)));
export const inicioSemana = (iso: string) => {
  const w = dow(iso);
  return addDays(iso, w === 0 ? -6 : 1 - w);
};
export const edad = (nac: string, hoy: string) => {
  const a = parseISO(nac), b = parseISO(hoy);
  let e = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) e--;
  return e;
};
