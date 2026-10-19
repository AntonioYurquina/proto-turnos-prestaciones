// Configuración del prototipo.
// `preparadoPara` se muestra solo como una pequeña cinta superior (se indica por URL: ?para=Nombre); no hay logos ni marcas.
export const config = {
  producto: 'Cuadrante',
  subtitulo: 'Turnos y facturación de prestaciones',
  preparadoPara: (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('para') ?? '').replace(/[<>]/g, '').slice(0, 60).trim() : '') || 'tu empresa',
  ciudad: 'San Salvador de Jujuy',
  moneda: 'ARS',
};
