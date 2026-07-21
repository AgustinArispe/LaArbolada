import { propertyImages, type PropertyImage } from '@/data/images.generated';
import { coverFocalPoints, imageOverrides, type FocalPoint } from '@/data/imageOverrides';
import {
  casaRoomOrder,
  departamentoRoomOrder,
  layoutVariants,
  type LayoutVariant,
} from '@/data/roomOrder';

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
  layoutVariant: LayoutVariant;
};

export type PropertyJourneyData = {
  id: PropertyKey;
  anchorId: string;
  name: string;
  heading: string;
  introduction: string;
  rooms: JourneyRoom[];
};

const imageById = new Map(propertyImages.map((image) => [image.id, image]));

function curateImage(id: string, room: string, fallbackOrder: number): CuratedImage {
  const image = imageById.get(id);
  if (!image) throw new Error(`No se encontró la imagen curada: ${id}`);
  const override = imageOverrides[id];

  return {
    ...image,
    room: override?.room ?? room,
    space: override?.room ?? room,
    order: override?.order ?? fallbackOrder,
    alt:
      override?.alt ??
      `${room} de ${image.property === 'casa' ? 'Casa La Arbolada' : 'el alojamiento independiente de La Arbolada'}.`,
    focalPoint: override?.focalPoint ?? coverFocalPoints[id],
  };
}

function makeRoom(
  property: PropertyKey,
  roomNumber: number,
  title: string,
  ids: string[],
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
    theme: roomNumber % 4 === 0 ? 'forest' : 'warm',
    layoutVariant: layoutVariants[(roomNumber - 1) % layoutVariants.length],
  };
}

const casaRooms: JourneyRoom[] = [
  makeRoom(
    'casa',
    1,
    casaRoomOrder[0],
    ['casa-verdeliving3casa', 'casa-patio7', 'casa-patio9'],
    'El recorrido comienza entre árboles, piedra y el puente sobre el arroyo.',
  ),
  makeRoom(
    'casa',
    2,
    casaRoomOrder[1],
    ['casa-fachada1', 'casa-fachada2', 'casa-fachada3', 'casa-fachada4'],
    'Piedra, madera y grandes aberturas hacia el parque.',
  ),
  makeRoom(
    'casa',
    3,
    casaRoomOrder[2],
    ['casa-livingcasa', 'casa-livingcasa3', 'casa-mesalivingcasa4', 'casa-5casa'],
    'Techo de madera, hogar de piedra y vistas abiertas al verde.',
  ),
  makeRoom('casa', 4, casaRoomOrder[3], [
    'casa-cocinacasa1',
    'casa-cocinacasa2',
    'casa-cocinacasa3',
    'casa-cocinacasa4',
    'casa-cocinacasa5',
  ]),
  makeRoom('casa', 5, casaRoomOrder[4], [
    'casa-dorm1casa1',
    'casa-dorm1casa2',
    'casa-dorm1casa3',
    'casa-dorm1casa5',
  ]),
  makeRoom('casa', 6, casaRoomOrder[5], ['casa-dorm2casa1', 'casa-dorm2casa2', 'casa-dorm2casa3']),
  makeRoom('casa', 7, casaRoomOrder[6], ['casa-dorm3casa1', 'casa-dorm3casa2']),
  makeRoom('casa', 8, casaRoomOrder[7], ['casa-dorm4casa1', 'casa-dorm4casa2']),
  makeRoom('casa', 9, casaRoomOrder[8], [
    'casa-banio1casa1',
    'casa-banio1casa2',
    'casa-banio1casa3',
  ]),
  makeRoom('casa', 10, casaRoomOrder[9], [
    'casa-banio2casa1',
    'casa-banio2casa2',
    'casa-banio2casa3',
  ]),
  makeRoom('casa', 11, casaRoomOrder[10], [
    'casa-patio1',
    'casa-patio2',
    'casa-patio3',
    'casa-patio4',
    'casa-patio5',
    'casa-patio6',
  ]),
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
    'El arroyo, los sauces y el parque cierran la visita.',
  ),
];

const departamentoRooms: JourneyRoom[] = [
  makeRoom(
    'departamento',
    1,
    departamentoRoomOrder[0],
    ['departamento-verdedpto1'],
    'Un acceso independiente dentro del mismo entorno arbolado.',
  ),
  makeRoom('departamento', 2, departamentoRoomOrder[1], [
    'departamento-livingdpto1',
    'departamento-livingdpto2',
  ]),
  makeRoom('departamento', 3, departamentoRoomOrder[2], ['departamento-cocinadpto1']),
  makeRoom('departamento', 4, departamentoRoomOrder[3], [
    'departamento-dormdpto1',
    'departamento-dormdpto2',
    'departamento-dormdpto3',
  ]),
  makeRoom('departamento', 5, departamentoRoomOrder[4], [
    'departamento-banio1dpto',
    'departamento-baniodpto2',
  ]),
  makeRoom(
    'departamento',
    6,
    departamentoRoomOrder[5],
    ['departamento-verdedpto2'],
    'Una última vista al parque antes de terminar el recorrido.',
  ),
];

export const journeys: Record<PropertyKey, PropertyJourneyData> = {
  casa: {
    id: 'casa',
    anchorId: 'casa',
    name: 'Casa principal',
    heading: 'Recorré la casa principal',
    introduction: 'Ambientes amplios, piedra, madera y grandes aberturas conectadas con el parque.',
    rooms: casaRooms,
  },
  departamento: {
    id: 'departamento',
    anchorId: 'alojamiento-independiente',
    name: 'Alojamiento independiente',
    heading: 'Conocé el alojamiento independiente',
    introduction: 'Una opción privada dentro del mismo entorno natural de La Arbolada.',
    rooms: departamentoRooms,
  },
};

const heroFrameConfigs: HeroFrameConfig[] = [
  {
    imageId: 'casa-fachada2',
    desktopPosition: '57% 52%',
    mobilePosition: '59% 53%',
    mobileMode: 'cover',
  },
  {
    imageId: 'casa-fachada4',
    desktopPosition: '56% 52%',
    mobilePosition: '63% 52%',
    mobileMode: 'cover',
  },
  {
    imageId: 'casa-patio7',
    desktopPosition: '58% 58%',
    mobilePosition: '66% 58%',
    mobileMode: 'contained-layer',
  },
  {
    imageId: 'departamento-verdedpto1',
    desktopPosition: '53% 53%',
    mobilePosition: '53% 55%',
    mobileMode: 'contained-layer',
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
