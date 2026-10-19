export type Modalidad = 'RM' | 'TC' | 'MN' | 'MG' | 'DMO';
export type EstadoTurno = 'asignado' | 'confirmado' | 'enSala' | 'atendido' | 'ausente' | 'cancelado';
export type EstadoAut = 'pendiente' | 'autorizada' | 'rechazada' | 'vencida';

export interface Sede { id: string; nombre: string; corto: string; direccion: string }

export interface Equipo {
  id: string;
  sedeId: string;
  nombre: string;
  codigo: string;
  modalidad: Modalidad;
  /** horario de lunes a viernes y de sábados (null = no opera) */
  semana: [string, string];
  sabado: [string, string] | null;
}

export interface ObraSocial { id: string; nombre: string; particular?: boolean }

export interface Convenio {
  osId: string;
  /** multiplicador sobre el nomenclador base (simulado) */
  factor: number;
  /** porcentaje que cubre la obra social (0-1); el resto es copago del afiliado */
  cobertura: number;
  plazoPagoDias: number;
  vigenciaAutDias: number;
  autModalidades: Modalidad[];
}

export interface Preparacion {
  ayunoHoras?: number;
  contraste?: boolean;
  nota?: string;
}

export interface ConsumoItem { insumoId: string; cantidad: number }

export interface Practica {
  id: string;
  codigo: string;
  nombre: string;
  modalidad: Modalidad;
  duracion: number;
  valorBase: number;
  preparacion?: Preparacion;
  consumo: ConsumoItem[];
}

export interface Insumo { id: string; nombre: string; unidad: string; costo: number }
export interface StockCfg { sedeId: string; insumoId: string; stockInicial: number; minimo: number }
export interface IngresoInsumo { id: string; fecha: string; sedeId: string; insumoId: string; cantidad: number; remito: string; proveedor: string }

export interface Esquema { tipo: 'porcentaje' | 'porPractica'; valor: number }
export interface Profesional {
  id: string;
  nombre: string;
  rol: 'medico' | 'tecnico';
  especialidad: string;
  matricula: string;
  modalidades: Modalidad[];
  sedes: string[];
  esquema: Esquema;
}

export interface Paciente {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  nacimiento: string;
  sexo: 'F' | 'M';
  telefono: string;
  osId: string;
  afiliado: string;
}

export interface Checklist { orden: boolean; autorizacion: boolean; dni: boolean; credencial: boolean; preparacion: boolean }

export interface Turno {
  id: string;
  fecha: string;
  hora: string;
  duracion: number;
  equipoId: string;
  pacienteId: string;
  practicaId: string;
  osId: string;
  profesionalId: string;
  tecnicoId: string;
  estado: EstadoTurno;
  autId?: string;
  /** hora de llegada (HH:MM) registrada en el check-in */
  llegada?: string;
  /** hora real de inicio/fin (HH:MM) */
  checks: Checklist;
  nota?: string;
  motivoCancelacion?: string;
  /** historial breve de cambios (para el detalle) */
  log?: string[];
}

export interface Autorizacion {
  id: string;
  pacienteId: string;
  osId: string;
  practicaId: string;
  turnoId?: string;
  estado: EstadoAut;
  nro?: string;
  solicitada: string;
  vigenciaHasta?: string;
  motivoRechazo?: string;
}

export interface Pago { id: string; fecha: string; monto: number; referencia: string }
export interface Debito {
  id: string;
  loteId: string;
  turnoId: string;
  osId: string;
  fecha: string;
  tipo: 'rechazo' | 'parcial';
  motivo: string;
  monto: number;
  estado: 'abierto' | 'reclamado' | 'aceptado' | 'recuperado';
}
export interface Lote {
  id: string;
  osId: string;
  periodo: string;
  generado: string;
  turnoIds: string[];
  pagos: Pago[];
}

export interface DB {
  version: number;
  seedDate: string;
  sedes: Sede[];
  equipos: Equipo[];
  obras: ObraSocial[];
  convenios: Convenio[];
  practicas: Practica[];
  insumos: Insumo[];
  stockCfg: StockCfg[];
  ingresos: IngresoInsumo[];
  profesionales: Profesional[];
  pacientes: Paciente[];
  turnos: Turno[];
  autorizaciones: Autorizacion[];
  lotes: Lote[];
  debitos: Debito[];
}

export const ESTADO_LABEL: Record<EstadoTurno, string> = {
  asignado: 'Asignado',
  confirmado: 'Confirmado',
  enSala: 'En sala',
  atendido: 'Atendido',
  ausente: 'Ausente',
  cancelado: 'Cancelado',
};
export const AUT_LABEL: Record<EstadoAut, string> = {
  pendiente: 'Pendiente',
  autorizada: 'Autorizada',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
};
export const MODALIDAD_LABEL: Record<Modalidad, string> = {
  RM: 'Resonancia',
  TC: 'Tomografía',
  MN: 'Medicina nuclear',
  MG: 'Mamografía',
  DMO: 'Densitometría',
};
