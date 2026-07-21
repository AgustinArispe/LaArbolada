export type FocalPoint = {
  desktop: { x: number; y: number };
  mobile: { x: number; y: number };
};

export type ImageOverride = {
  room: string;
  order: number;
  alt: string;
  focalPoint?: FocalPoint;
  note: string;
};

/**
 * Correcciones curatoriales sobre nombres que no expresan con precisión
 * el ambiente fotografiado. `images.generated.ts` continúa siendo generado
 * por el pipeline; estas decisiones manuales viven sólo en este archivo.
 */
export const imageOverrides: Record<string, ImageOverride> = {
  'casa-5casa': {
    room: 'Sala de estar y comedor',
    order: 5,
    alt: 'Hogar de piedra y madera de la sala de estar de Casa La Arbolada.',
    note: '5CASA.HEIC muestra el hogar de la sala de estar. Se elimina la clasificación “Espacio 5”.',
  },
  'casa-livingcasa': {
    room: 'Sala de estar y comedor',
    order: 1,
    alt: 'Vista amplia de la sala de estar y el comedor de Casa La Arbolada.',
    note: 'El archivo no tiene número final; se ubica primero por ser la vista general.',
  },
  'casa-verdeliving3casa': {
    room: 'Entorno y llegada',
    order: 1,
    alt: 'Acceso de piedra y portón de entrada a Casa La Arbolada.',
    note: 'La fotografía muestra el acceso, no una categoría genérica de entorno verde.',
  },
  'casa-patio7': {
    room: 'Entorno y llegada',
    order: 2,
    alt: 'Puente de piedra sobre el arroyo, con la casa al fondo.',
    focalPoint: {
      desktop: { x: 58, y: 58 },
      mobile: { x: 66, y: 58 },
    },
    note: 'Se usa como continuidad del acceso por su vista del puente y el arroyo.',
  },
  'casa-patio9': {
    room: 'Entorno y llegada',
    order: 3,
    alt: 'Puente sobre el arroyo en el camino hacia la casa.',
    note: 'Complementa la llegada y queda fuera del capítulo Patio.',
  },
  'casa-patio8': {
    room: 'Parque, arroyo y entorno verde',
    order: 1,
    alt: 'Arroyo entre sauces y parque de Casa La Arbolada.',
    note: 'La imagen corresponde al paisaje abierto y al arroyo.',
  },
  'casa-patio10': {
    room: 'Parque, arroyo y entorno verde',
    order: 2,
    alt: 'Horno de barro y parque arbolado de Casa La Arbolada.',
    note: 'Se reserva para el cierre del recorrido exterior.',
  },
  'casa-patio11': {
    room: 'Parque, arroyo y entorno verde',
    order: 3,
    alt: 'Parque arbolado junto a la casa.',
    note: 'Es una vista general del parque, no del patio inmediato.',
  },
  'casa-verdedorm1casa': {
    room: 'Parque, arroyo y entorno verde',
    order: 4,
    alt: 'Vista del parque desde una ventana de la casa.',
    note: 'La numeración del archivo refiere al dormitorio desde donde se tomó la vista.',
  },
  'casa-verdedorm2casa': {
    room: 'Parque, arroyo y entorno verde',
    order: 5,
    alt: 'Atardecer sobre el parque visto desde la casa.',
    note: 'La numeración del archivo refiere al dormitorio desde donde se tomó la vista.',
  },
  'casa-verdedorm3casa': {
    room: 'Parque, arroyo y entorno verde',
    order: 6,
    alt: 'Galería de piedra abierta hacia el parque.',
    note: 'La imagen documenta la relación entre la casa y el paisaje.',
  },
  'casa-verdeliving1casa': {
    room: 'Parque, arroyo y entorno verde',
    order: 7,
    alt: 'Vista del parque y las sierras desde la sala de estar.',
    note: 'La numeración original describe el punto de toma, no un ambiente independiente.',
  },
  'casa-verdeliving2casa': {
    room: 'Parque, arroyo y entorno verde',
    order: 8,
    alt: 'Vista del parque desde la salida de la sala de estar.',
    note: 'La numeración original describe el punto de toma, no un ambiente independiente.',
  },
  'departamento-banio1dpto': {
    room: 'Baño',
    order: 1,
    alt: 'Baño del alojamiento independiente.',
    note: 'Se unifica con banioDPTO2 en un único capítulo Baño.',
  },
  'departamento-baniodpto2': {
    room: 'Baño',
    order: 2,
    alt: 'Ducha y sanitarios del alojamiento independiente.',
    note: 'Se unifica con banio1DPTO en un único capítulo Baño.',
  },
  'departamento-verdedpto1': {
    room: 'Acceso y entorno',
    order: 1,
    alt: 'Vista del parque al ingresar al alojamiento independiente.',
    focalPoint: {
      desktop: { x: 53, y: 53 },
      mobile: { x: 53, y: 55 },
    },
    note: 'Se usa como apertura del recorrido por el departamento.',
  },
  'departamento-verdedpto2': {
    room: 'Entorno verde',
    order: 1,
    alt: 'Parque arbolado junto al alojamiento independiente.',
    note: 'Se reserva para el cierre del recorrido por el departamento.',
  },
};

export const coverFocalPoints: Record<string, FocalPoint> = {
  'casa-fachada2': {
    desktop: { x: 57, y: 52 },
    mobile: { x: 59, y: 53 },
  },
  'casa-fachada4': {
    desktop: { x: 56, y: 52 },
    mobile: { x: 63, y: 52 },
  },
  'casa-patio1': {
    desktop: { x: 50, y: 53 },
    mobile: { x: 50, y: 54 },
  },
  'casa-livingcasa': {
    desktop: { x: 56, y: 50 },
    mobile: { x: 58, y: 48 },
  },
  'departamento-livingdpto1': {
    desktop: { x: 49, y: 52 },
    mobile: { x: 51, y: 52 },
  },
};
