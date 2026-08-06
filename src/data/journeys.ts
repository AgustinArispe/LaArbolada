import { propertyImages, type FocalPoint, type PropertyImage } from '@/data/images';
import { casaRoomOrder, departamentoRoomOrder, type Presentation } from '@/data/roomOrder';

export type PropertyKey = 'casa' | 'departamento';

export type HeroFrameConfig = {
  imageId: string;
  desktopPosition: string;
  mobilePosition: string;
  mobileMode: 'cover' | 'contained-layer';
};

export type CuratedImage = Omit<PropertyImage, 'focalPoint'> & {
  room: string;
  focalPoint?: FocalPoint;
};

export type HeroFrame = HeroFrameConfig & {
  image: CuratedImage;
};

export type JourneyRoom = {
  property: PropertyKey;
  room: string;
  roomNumber: number;
  title: string;
  description?: string;
  images: CuratedImage[];
  theme: 'warm' | 'forest';
  presentation: Presentation;
};

export type PropertyJourneyData = {
  id: PropertyKey;
  anchorId: string;
  name: string;
  heading: string;
  introduction: string;
  facts: string;
  overviewImage: CuratedImage;
  homeCardImage: CuratedImage;
  rooms: JourneyRoom[];
};

const imageById = new Map(propertyImages.map((image) => [image.id, image]));

function curateImage(id: string, room: string, order: number): CuratedImage {
  const image = imageById.get(id);
  if (!image) throw new Error(`No se encontró la imagen curada: ${id}`);

  return {
    ...image,
    room,
    space: room,
    order,
  };
}

function makeRoom(
  property: PropertyKey,
  roomNumber: number,
  title: string,
  ids: string[],
  presentation: Presentation,
  theme: 'warm' | 'forest' = 'warm',
  description?: string,
): JourneyRoom {
  return {
    property,
    room: title,
    roomNumber,
    title,
    description,
    images: ids.map((id, index) => curateImage(id, title, index + 1)),
    theme,
    presentation,
  };
}

const casaRooms: JourneyRoom[] = [
  makeRoom(
    'casa',
    1,
    casaRoomOrder[0],
    ['casa-arrival-entrance', 'casa-arrival-bridge'],
    'hero-media',
    'forest',
    'La llegada recorre el arroyo, la piedra y la entrada de madera.',
  ),
  makeRoom(
    'casa',
    2,
    casaRoomOrder[1],
    ['casa-exterior-hero', 'casa-exterior-park'],
    'framed',
    'warm',
    'La residencia se abre al parque entre muros de piedra, pérgola y arboleda.',
  ),
  makeRoom(
    'casa',
    3,
    casaRoomOrder[2],
    ['casa-living-wide', 'casa-living-dining'],
    'split',
    'warm',
    'Madera, piedra y vistas abiertas construyen el ambiente común.',
  ),
  makeRoom(
    'casa',
    4,
    casaRoomOrder[3],
    ['casa-kitchen-island', 'casa-kitchen-detail', 'casa-kitchen-dining'],
    'dark',
    'forest',
  ),
  makeRoom(
    'casa',
    5,
    casaRoomOrder[4],
    ['casa-bedroom-main', 'casa-living-hearth', 'casa-bedroom-garden', 'casa-bedroom-terrace', 'casa-bedroom-twin'],
    'framed',
    'warm',
  ),
  makeRoom('casa', 6, casaRoomOrder[5], ['casa-bath-main', 'casa-bath-secondary'], 'detail', 'warm'),
  makeRoom(
    'casa',
    7,
    casaRoomOrder[6],
    ['casa-patio-sunset', 'casa-park-stone', 'casa-creek', 'casa-park-willow'],
    'hero-media',
    'forest',
    'El parque, la piedra y el arroyo dan el cierre natural al recorrido.',
  ),
];

const departamentoRooms: JourneyRoom[] = [
  makeRoom(
    'departamento',
    1,
    departamentoRoomOrder[0],
    ['departamento-exterior-wide', 'departamento-exterior-hero'],
    'hero-media',
    'forest',
    'Un acceso independiente, integrado al mismo parque arbolado.',
  ),
  makeRoom(
    'departamento',
    2,
    departamentoRoomOrder[1],
    ['departamento-living-wide', 'departamento-dining', 'departamento-kitchen'],
    'split',
    'warm',
  ),
  makeRoom(
    'departamento',
    3,
    departamentoRoomOrder[2],
    ['departamento-bedroom-main', 'departamento-bedroom-twin'],
    'framed',
    'warm',
  ),
  makeRoom(
    'departamento',
    4,
    departamentoRoomOrder[3],
    ['departamento-bath-wide', 'departamento-bath-detail'],
    'detail',
    'warm',
  ),
  makeRoom(
    'departamento',
    5,
    departamentoRoomOrder[4],
    ['departamento-pergola', 'departamento-wood-oven'],
    'panoramic',
    'warm',
    'Una última vista hacia los espacios compartidos del parque.',
  ),
];

export const journeys: Record<PropertyKey, PropertyJourneyData> = {
  casa: {
    id: 'casa',
    anchorId: 'casa',
    name: 'Residencia principal',
    heading: 'Residencia principal',
    introduction: 'Ambientes amplios, piedra, madera y vistas abiertas hacia el parque.',
    facts: '3 dormitorios · 7 camas · 3 baños',
    overviewImage: curateImage('casa-exterior-park', 'Exterior', 1),
    homeCardImage: curateImage('casa-arrival-entrance', 'Entrada principal', 1),
    rooms: casaRooms,
  },
  departamento: {
    id: 'departamento',
    anchorId: 'alojamiento-independiente',
    name: 'Departamento independiente',
    heading: 'Departamento independiente',
    introduction:
      'Este departamento cuenta con un dormitorio con 3 camas, baño y cocina comedor amplia.',
    facts: '1 dormitorio · 3 camas · baño · cocina comedor',
    overviewImage: curateImage('departamento-exterior-hero', 'Exterior del departamento', 1),
    homeCardImage: curateImage('departamento-exterior-hero', 'Exterior del departamento', 1),
    rooms: departamentoRooms,
  },
};

const heroFrameConfigs: HeroFrameConfig[] = [
  {
    imageId: 'casa-exterior-hero',
    desktopPosition: '54% 53%',
    mobilePosition: '54% 54%',
    mobileMode: 'cover',
  },
  {
    imageId: 'casa-arrival-entrance',
    desktopPosition: '50% 50%',
    mobilePosition: '50% 50%',
    mobileMode: 'cover',
  },
  {
    imageId: 'casa-creek',
    desktopPosition: '52% 54%',
    mobilePosition: '54% 54%',
    mobileMode: 'contained-layer',
  },
  {
    imageId: 'casa-living-wide',
    desktopPosition: '51% 50%',
    mobilePosition: '52% 49%',
    mobileMode: 'cover',
  },
];

export const heroFrames: HeroFrame[] = heroFrameConfigs.map((config, index) => ({
  ...config,
  image: curateImage(config.imageId, 'La Arbolada', index + 1),
}));

export function validateJourneys(
  source: Record<PropertyKey, PropertyJourneyData> = journeys,
): void {
  for (const [property, journey] of Object.entries(source) as [
    PropertyKey,
    PropertyJourneyData,
  ][]) {
    if (journey.id !== property) {
      throw new Error(`El recorrido ${property} tiene un identificador inconsistente.`);
    }

    journey.rooms.forEach((room, index) => {
      const expectedNumber = index + 1;
      if (room.property !== property || room.roomNumber !== expectedNumber) {
        throw new Error(
          `Capítulo desordenado en ${property}: se esperaba ${expectedNumber} y se recibió ${room.roomNumber}.`,
        );
      }
      room.images.forEach((image) => {
        if (image.property !== property || image.room !== room.room) {
          throw new Error(`La imagen ${image.id} no pertenece a ${property} / ${room.room}.`);
        }
      });
    });
  }
}

validateJourneys();
