const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
export const $ = (n: number) => money.format(Math.round(n));
export const n1 = (n: number) => num.format(n);
export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d).replace('.', ',')}%`;
export const dniFmt = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const nombreCompleto = (p: { apellido: string; nombre: string }) => `${p.apellido}, ${p.nombre}`;
/** $ compacto para ejes de gráficos */
export const $corto = (n: number) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1).replace('.', ',')} M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)} mil`;
  return `$${n}`;
};
