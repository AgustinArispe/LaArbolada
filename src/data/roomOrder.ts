export const casaRoomOrder = [
  'Parque y llegada',
  'Exterior',
  'Sala de estar y comedor',
  'Cocina',
  'Dormitorios',
  'Baños',
  'Parque y arroyo',
] as const;

export const departamentoRoomOrder = [
  'Acceso privado',
  'Cocina, comedor y estar',
  'Dormitorio',
  'Baño',
  'Entorno natural',
] as const;

export type Presentation = 'hero-media' | 'framed' | 'split' | 'dark' | 'panoramic' | 'detail';
