export const casaRoomOrder = [
  'Entorno y llegada',
  'Fachada',
  'Living y comedor',
  'Cocina',
  'Dormitorio 1',
  'Dormitorio 2',
  'Dormitorio 3',
  'Dormitorio 4',
  'Baño 1',
  'Baño 2',
  'Patio',
  'Parque, arroyo y entorno verde',
] as const;

export const departamentoRoomOrder = [
  'Acceso y entorno',
  'Living',
  'Cocina',
  'Dormitorio',
  'Baño',
  'Entorno verde',
] as const;

export type LayoutVariant =
  | 'offset-left'
  | 'offset-right'
  | 'panoramic'
  | 'text-column'
  | 'sticky-title';

export const layoutVariants: LayoutVariant[] = [
  'offset-left',
  'offset-right',
  'panoramic',
  'text-column',
  'sticky-title',
];
