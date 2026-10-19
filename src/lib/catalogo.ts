import type { Convenio, Equipo, Insumo, ObraSocial, Practica, Sede } from '../types';

export const SEDES: Sede[] = [
  { id: 'centro', nombre: 'Sede Centro', corto: 'Centro', direccion: 'San Salvador de Jujuy' },
  { id: 'alto', nombre: 'Sede Alto Comedero', corto: 'Alto Comedero', direccion: 'San Salvador de Jujuy' },
];

export const EQUIPOS: Equipo[] = [
  { id: 'rm1', sedeId: 'centro', nombre: 'Resonador 1,5 T', codigo: 'RM-1', modalidad: 'RM', semana: ['08:00', '19:00'], sabado: ['08:00', '13:00'] },
  { id: 'tc1', sedeId: 'centro', nombre: 'Tomógrafo 16 cortes', codigo: 'TC-1', modalidad: 'TC', semana: ['08:00', '19:00'], sabado: ['08:00', '13:00'] },
  { id: 'mg1', sedeId: 'centro', nombre: 'Mamógrafo digital', codigo: 'MG-1', modalidad: 'MG', semana: ['08:00', '18:00'], sabado: ['08:00', '13:00'] },
  { id: 'tc2', sedeId: 'alto', nombre: 'Tomógrafo 64 cortes', codigo: 'TC-2', modalidad: 'TC', semana: ['08:00', '19:00'], sabado: null },
  { id: 'mn1', sedeId: 'alto', nombre: 'Gammacámara SPECT', codigo: 'MN-1', modalidad: 'MN', semana: ['08:00', '17:00'], sabado: null },
  { id: 'dmo1', sedeId: 'alto', nombre: 'Densitómetro óseo', codigo: 'DMO-1', modalidad: 'DMO', semana: ['08:00', '17:00'], sabado: null },
];

export const OBRAS: ObraSocial[] = [
  { id: 'prov', nombre: 'Obra Social Provincial' },
  { id: 'pami', nombre: 'PAMI (simulado)' },
  { id: 'pa', nombre: 'Prepaga A' },
  { id: 'pb', nombre: 'Prepaga B' },
  { id: 'pc', nombre: 'Prepaga C' },
  { id: 'part', nombre: 'Particular', particular: true },
];

export const CONVENIOS: Convenio[] = [
  { osId: 'prov', factor: 0.82, cobertura: 0.8, plazoPagoDias: 60, vigenciaAutDias: 30, autModalidades: ['RM', 'TC', 'MN'] },
  { osId: 'pami', factor: 0.7, cobertura: 1, plazoPagoDias: 90, vigenciaAutDias: 30, autModalidades: ['RM', 'TC', 'MN'] },
  { osId: 'pa', factor: 1.1, cobertura: 0.9, plazoPagoDias: 30, vigenciaAutDias: 45, autModalidades: ['RM', 'TC', 'MN'] },
  { osId: 'pb', factor: 1.0, cobertura: 0.85, plazoPagoDias: 45, vigenciaAutDias: 30, autModalidades: ['RM', 'TC', 'MN'] },
  { osId: 'pc', factor: 0.95, cobertura: 0.7, plazoPagoDias: 45, vigenciaAutDias: 30, autModalidades: ['RM', 'TC', 'MN'] },
  { osId: 'part', factor: 1.25, cobertura: 0, plazoPagoDias: 0, vigenciaAutDias: 0, autModalidades: [] },
];

export const INSUMOS: Insumo[] = [
  { id: 'gad', nombre: 'Contraste paramagnético (vial 15 ml)', unidad: 'vial', costo: 38000 },
  { id: 'iod', nombre: 'Contraste yodado (frasco 100 ml)', unidad: 'frasco', costo: 24000 },
  { id: 'tc99', nombre: 'Radiofármaco Tc-99m (dosis)', unidad: 'dosis', costo: 31000 },
  { id: 'kit', nombre: 'Kit jeringa para inyectora', unidad: 'kit', costo: 6500 },
  { id: 'via', nombre: 'Catéter periférico 20G', unidad: 'unidad', costo: 1800 },
  { id: 'placa', nombre: 'Placa impresa 35 x 43 cm', unidad: 'placa', costo: 3200 },
  { id: 'sobre', nombre: 'Sobre con CD del estudio', unidad: 'unidad', costo: 900 },
];

const ci = (insumoId: string, cantidad: number) => ({ insumoId, cantidad });
export const PRACTICAS: Practica[] = [
  // Resonancia
  { id: 'rm-enc', codigo: 'NS-4101', nombre: 'RM de encéfalo', modalidad: 'RM', duracion: 30, valorBase: 148000, consumo: [ci('placa', 2), ci('sobre', 1)] },
  { id: 'rm-enc-c', codigo: 'NS-4102', nombre: 'RM de encéfalo con contraste', modalidad: 'RM', duracion: 45, valorBase: 205000, preparacion: { ayunoHoras: 4, contraste: true, nota: 'Traer estudio de función renal reciente.' }, consumo: [ci('gad', 1), ci('kit', 1), ci('via', 1), ci('placa', 2), ci('sobre', 1)] },
  { id: 'rm-lumbar', codigo: 'NS-4110', nombre: 'RM de columna lumbosacra', modalidad: 'RM', duracion: 30, valorBase: 150000, consumo: [ci('placa', 2), ci('sobre', 1)] },
  { id: 'rm-rodilla', codigo: 'NS-4115', nombre: 'RM de rodilla', modalidad: 'RM', duracion: 30, valorBase: 138000, consumo: [ci('placa', 2), ci('sobre', 1)] },
  { id: 'rm-hombro', codigo: 'NS-4116', nombre: 'RM de hombro', modalidad: 'RM', duracion: 30, valorBase: 138000, consumo: [ci('placa', 2), ci('sobre', 1)] },
  { id: 'rm-abd-c', codigo: 'NS-4120', nombre: 'RM de abdomen superior con contraste', modalidad: 'RM', duracion: 45, valorBase: 228000, preparacion: { ayunoHoras: 6, contraste: true, nota: 'Retirar objetos metálicos y consultar por implantes.' }, consumo: [ci('gad', 2), ci('kit', 1), ci('via', 1), ci('placa', 2), ci('sobre', 1)] },
  // Tomografía
  { id: 'tc-torax', codigo: 'NS-3201', nombre: 'TC de tórax', modalidad: 'TC', duracion: 20, valorBase: 96000, consumo: [ci('placa', 2), ci('sobre', 1)] },
  { id: 'tc-abd-c', codigo: 'NS-3202', nombre: 'TC de abdomen y pelvis con contraste', modalidad: 'TC', duracion: 30, valorBase: 138000, preparacion: { ayunoHoras: 6, contraste: true, nota: 'Traer estudio de función renal reciente. Hidratación previa indicada.' }, consumo: [ci('iod', 1), ci('kit', 1), ci('via', 1), ci('placa', 2), ci('sobre', 1)] },
  { id: 'tc-cerebro', codigo: 'NS-3203', nombre: 'TC de cerebro simple', modalidad: 'TC', duracion: 15, valorBase: 82000, consumo: [ci('placa', 2), ci('sobre', 1)] },
  { id: 'tc-senos', codigo: 'NS-3204', nombre: 'TC de senos paranasales', modalidad: 'TC', duracion: 15, valorBase: 70000, consumo: [ci('placa', 1), ci('sobre', 1)] },
  { id: 'tc-lumbar', codigo: 'NS-3205', nombre: 'TC de columna lumbar', modalidad: 'TC', duracion: 20, valorBase: 90000, consumo: [ci('placa', 2), ci('sobre', 1)] },
  // Mamografía
  { id: 'mg-bil', codigo: 'NS-2101', nombre: 'Mamografía bilateral', modalidad: 'MG', duracion: 20, valorBase: 48000, preparacion: { nota: 'No usar desodorante, talco ni cremas el día del estudio.' }, consumo: [ci('placa', 2), ci('sobre', 1)] },
  { id: 'mg-uni', codigo: 'NS-2102', nombre: 'Mamografía unilateral', modalidad: 'MG', duracion: 15, valorBase: 32000, preparacion: { nota: 'No usar desodorante, talco ni cremas el día del estudio.' }, consumo: [ci('placa', 1), ci('sobre', 1)] },
  // Medicina nuclear
  { id: 'mn-oseo', codigo: 'NS-5101', nombre: 'Centellograma óseo corporal total', modalidad: 'MN', duracion: 45, valorBase: 175000, preparacion: { nota: 'Hidratación abundante. Se inyecta el radiofármaco y se espera aprox. 3 h antes de las imágenes.' }, consumo: [ci('tc99', 1), ci('via', 1), ci('sobre', 1)] },
  { id: 'mn-tiroides', codigo: 'NS-5102', nombre: 'Centellograma tiroideo', modalidad: 'MN', duracion: 30, valorBase: 120000, preparacion: { nota: 'Consultar indicaciones previas con el servicio al confirmar el turno.' }, consumo: [ci('tc99', 1), ci('via', 1), ci('sobre', 1)] },
  { id: 'mn-spect', codigo: 'NS-5105', nombre: 'SPECT de perfusión miocárdica', modalidad: 'MN', duracion: 60, valorBase: 260000, preparacion: { ayunoHoras: 4, nota: 'Evitar cafeína 24 h antes. Concurrir con ropa cómoda.' }, consumo: [ci('tc99', 2), ci('via', 1), ci('sobre', 1)] },
  // Densitometría
  { id: 'dmo-cl', codigo: 'NS-1101', nombre: 'Densitometría ósea de columna y cadera', modalidad: 'DMO', duracion: 15, valorBase: 42000, preparacion: { nota: 'No tomar suplementos de calcio en las 24 h previas.' }, consumo: [ci('placa', 1), ci('sobre', 1)] },
];

export const PRACTICA_PESOS: Record<string, [string, number][]> = {
  RM: [['rm-enc', 22], ['rm-enc-c', 8], ['rm-lumbar', 26], ['rm-rodilla', 20], ['rm-hombro', 14], ['rm-abd-c', 6]],
  TC: [['tc-torax', 22], ['tc-abd-c', 20], ['tc-cerebro', 22], ['tc-senos', 14], ['tc-lumbar', 22]],
  MG: [['mg-bil', 80], ['mg-uni', 20]],
  MN: [['mn-oseo', 45], ['mn-tiroides', 30], ['mn-spect', 25]],
  DMO: [['dmo-cl', 100]],
};
