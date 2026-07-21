export const casaRoomOrder = [
  'Parque y llegada',
  'Exterior',
  'Sala de estar y comedor',
  'Cocina',
  'Dormitorio 1',
  'Dormitorio 2',
  'Dormitorio 3',
  'Dormitorio 4',
  'Baño 1',
  'Baño 2',
  'Patio',
  'Parque y arroyo',
] as const;

export const departamentoRoomOrder = [
  'Acceso privado',
  'Sala de estar',
  'Cocina',
  'Dormitorio',
  'Baño',
  'Entorno natural',
] as const;

export type Presentation = 'hero-media' | 'framed' | 'split' | 'dark' | 'panoramic' | 'detail';
