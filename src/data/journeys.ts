import { propertyImages, type PropertyImage } from '@/data/images';
import { coverFocalPoints, imageOverrides, type FocalPoint } from '@/data/imageOverrides';
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
  rooms: JourneyRoom[];
};

const imageById = new Map(propertyImages.map((image) => [image.id, image]));

function curateImage(id: string, room: string, fallbackOrder: number): CuratedImage {
  const image = imageById.get(id);
  if (!image) throw new Error(`No se encontró la imagen curada: ${id}`);
  const override = imageOverrides[id];

  return {
    ...image,
    room,
    space: room,
    order: override?.order ?? fallbackOrder,
    alt:
      override?.alt ??
      `${room.replace(/\s+\d+$/, '')} de ${image.property === 'casa' ? 'La Arbolada' : 'el departamento independiente de La Arbolada'}.`,
    focalPoint: override?.focalPoint ?? coverFocalPoints[id],
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
  const images = ids
    .map((id, index) => curateImage(id, title, index + 1))
    .sort((a, b) => a.order - b.order);

  return {
    property,
    room: title,
    roomNumber,
    title,
    description,
    images,
    theme,
    presentation,
  };
}

const casaRooms: JourneyRoom[] = [
  makeRoom(
    'casa',
    1,
    casaRoomOrder[0],
    ['casa-verdeliving3casa', 'casa-patio7', 'casa-patio9'],
    'hero-media',
    'forest',
    'La llegada recorre árboles, piedra y el puente sobre el arroyo.',
  ),
  makeRoom(
    'casa',
    2,
    casaRoomOrder[1],
    ['casa-fachada1', 'casa-fachada2', 'casa-fachada3', 'casa-fachada4'],
    'framed',
    'warm',
    'Piedra, madera y grandes aberturas hacia el parque.',
  ),
  makeRoom(
    'casa',
    3,
    casaRoomOrder[2],
    ['casa-livingcasa', 'casa-livingcasa3', 'casa-mesalivingcasa4', 'casa-5casa'],
    'split',
    'warm',
    'Techos de madera, hogar de piedra y vistas abiertas al parque.',
  ),
  makeRoom(
    'casa',
    4,
    casaRoomOrder[3],
    [
      'casa-cocinacasa1',
      'casa-cocinacasa2',
      'casa-cocinacasa3',
      'casa-cocinacasa4',
      'casa-cocinacasa5',
    ],
    'dark',
    'forest',
  ),
  makeRoom(
    'casa',
    5,
    casaRoomOrder[4],
    ['casa-dorm1casa1', 'casa-dorm1casa2', 'casa-dorm1casa3', 'casa-dorm1casa5'],
    'detail',
    'warm',
  ),
  makeRoom(
    'casa',
    6,
    casaRoomOrder[5],
    ['casa-dorm2casa1', 'casa-dorm2casa2', 'casa-dorm2casa3'],
    'framed',
    'warm',
  ),
  makeRoom('casa', 7, casaRoomOrder[6], ['casa-dorm3casa1', 'casa-dorm3casa2'], 'split', 'warm'),
  makeRoom('casa', 8, casaRoomOrder[7], ['casa-dorm4casa1', 'casa-dorm4casa2'], 'dark', 'forest'),
  makeRoom(
    'casa',
    9,
    casaRoomOrder[8],
    ['casa-banio1casa1', 'casa-banio1casa2', 'casa-banio1casa3'],
    'detail',
    'warm',
  ),
  makeRoom(
    'casa',
    10,
    casaRoomOrder[9],
    ['casa-banio2casa1', 'casa-banio2casa2', 'casa-banio2casa3'],
    'framed',
    'warm',
  ),
  makeRoom(
    'casa',
    11,
    casaRoomOrder[10],
    ['casa-patio1', 'casa-patio2', 'casa-patio3', 'casa-patio4', 'casa-patio5', 'casa-patio6'],
    'panoramic',
    'warm',
  ),
  makeRoom(
    'casa',
    12,
    casaRoomOrder[11],
    [
      'casa-patio8',
      'casa-patio10',
      'casa-patio11',
      'casa-verdedorm1casa',
      'casa-verdedorm2casa',
      'casa-verdedorm3casa',
      'casa-verdeliving1casa',
      'casa-verdeliving2casa',
    ],
    'hero-media',
    'forest',
    'El arroyo, los árboles y el parque definen el entorno.',
  ),
];

const departamentoRooms: JourneyRoom[] = [
  makeRoom(
    'departamento',
    1,
    departamentoRoomOrder[0],
    ['departamento-verdedpto1'],
    'hero-media',
    'forest',
    'Un acceso privado dentro del mismo entorno arbolado.',
  ),
  makeRoom(
    'departamento',
    2,
    departamentoRoomOrder[1],
    ['departamento-livingdpto1', 'departamento-livingdpto2'],
    'split',
    'warm',
  ),
  makeRoom(
    'departamento',
    3,
    departamentoRoomOrder[2],
    ['departamento-cocinadpto1'],
    'dark',
    'forest',
  ),
  makeRoom(
    'departamento',
    4,
    departamentoRoomOrder[3],
    ['departamento-dormdpto1', 'departamento-dormdpto2', 'departamento-dormdpto3'],
    'framed',
    'warm',
  ),
  makeRoom(
    'departamento',
    5,
    departamentoRoomOrder[4],
    ['departamento-banio1dpto', 'departamento-baniodpto2'],
    'detail',
    'warm',
  ),
  makeRoom(
    'departamento',
    6,
    departamentoRoomOrder[5],
    ['departamento-verdedpto2'],
    'panoramic',
    'warm',
    'Una última vista abierta hacia el parque.',
  ),
];

const departamentoExteriorImage: CuratedImage = {
  ...casaRooms[1].images[2],
  property: 'departamento',
  room: 'Exterior del departamento',
  space: 'Exterior del departamento',
  alt: 'Frente de piedra y acceso lateral del departamento independiente de La Arbolada.',
  focalPoint: {
    desktop: { x: 72, y: 72 },
    mobile: { x: 73, y: 68 },
  },
};

export const journeys: Record<PropertyKey, PropertyJourneyData> = {
  casa: {
    id: 'casa',
    anchorId: 'casa',
    name: 'Residencia principal',
    heading: 'Residencia principal',
    introduction: 'Ambientes amplios, piedra, madera y vistas abiertas hacia el parque.',
    facts: '3 dormitorios · 7 camas · 3 baños',
    overviewImage: casaRooms[1].images[3],
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
    overviewImage: departamentoExteriorImage,
    rooms: departamentoRooms,
  },
};

const heroFrameConfigs: HeroFrameConfig[] = [
  {
    imageId: 'casa-fachada4',
    desktopPosition: '56% 52%',
    mobilePosition: '63% 52%',
    mobileMode: 'cover',
  },
  {
    imageId: 'casa-fachada1',
    desktopPosition: '52% 54%',
    mobilePosition: '55% 55%',
    mobileMode: 'cover',
  },
  {
    imageId: 'casa-patio7',
    desktopPosition: '58% 58%',
    mobilePosition: '66% 58%',
    mobileMode: 'contained-layer',
  },
  {
    imageId: 'casa-fachada3',
    desktopPosition: '72% 72%',
    mobilePosition: '73% 68%',
    mobileMode: 'cover',
  },
];

export const heroFrames: HeroFrame[] = heroFrameConfigs.map((config, index) => ({
  ...config,
  image: curateImage(
    config.imageId,
    index < 2 ? 'Fachada' : index === 2 ? 'Entorno y llegada' : 'Acceso y entorno',
    index + 1,
  ),
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
      if (room.room !== room.title) {
        throw new Error(
          `Título y ambiente desincronizados en ${property}, capítulo ${room.roomNumber}.`,
        );
      }
      room.images.forEach((image, imageIndex) => {
        if (image.property !== property || image.room !== room.room) {
          throw new Error(`La imagen ${image.id} no pertenece a ${property} / ${room.room}.`);
        }
        if (imageIndex > 0 && room.images[imageIndex - 1].order > image.order) {
          throw new Error(`Las imágenes de ${property} / ${room.room} no están ordenadas.`);
        }
      });
    });
  }
}

validateJourneys();
