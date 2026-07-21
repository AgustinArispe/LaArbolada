export type AmenityCategory = 'spaces' | 'comfort' | 'outdoors' | 'included';

export type Amenity = {
  id: string;
  label: string;
  description?: string;
  category: AmenityCategory;
  icon: string;
  featured?: boolean;
  imageId?: string;
  confirmed: true;
};

export type AmenityFeature = {
  id: string;
  label: string;
  description: string;
  amenityIds: string[];
  imageId: string;
  size: 'wide' | 'standard' | 'tall';
};

export const amenities: Amenity[] = [
  {
    id: 'four-bedrooms',
    label: '4 habitaciones en la casa principal',
    category: 'spaces',
    icon: 'BedDouble',
    featured: true,
    confirmed: true,
  },
  {
    id: 'seven-beds',
    label: '7 camas en la casa principal',
    category: 'spaces',
    icon: 'Bed',
    featured: true,
    confirmed: true,
  },
  {
    id: 'eight-guests',
    label: 'Capacidad para 8 personas en la casa principal',
    category: 'spaces',
    icon: 'Users',
    featured: true,
    confirmed: true,
  },
  {
    id: 'two-bathrooms',
    label: '2 baños',
    category: 'spaces',
    icon: 'Bath',
    featured: true,
    confirmed: true,
  },
  {
    id: 'independent-accommodation',
    label: 'Alojamiento independiente',
    description: '1 habitación con 3 camas, baño, sala de estar y cocina privados.',
    category: 'spaces',
    icon: 'House',
    featured: true,
    confirmed: true,
  },
  {
    id: 'radiator-heating',
    label: 'Calefacción por radiadores',
    category: 'comfort',
    icon: 'ThermometerSun',
    featured: true,
    confirmed: true,
  },
  {
    id: 'wood-fireplace',
    label: 'Hogar a leña',
    category: 'comfort',
    icon: 'Flame',
    confirmed: true,
  },
  { id: 'wifi', label: 'Wi-Fi', category: 'comfort', icon: 'Wifi', confirmed: true },
  { id: 'smart-tv', label: 'Smart TV', category: 'comfort', icon: 'Tv', confirmed: true },
  {
    id: 'linen',
    label: 'Ropa de cama incluida',
    category: 'included',
    icon: 'Bed',
    confirmed: true,
  },
  { id: 'towels', label: 'Toallas incluidas', category: 'included', icon: 'Bath', confirmed: true },
  {
    id: 'equipped-kitchen',
    label: 'Cocina equipada',
    category: 'spaces',
    icon: 'CookingPot',
    confirmed: true,
  },
  {
    id: 'living-dining',
    label: 'Sala de estar y comedor amplios',
    category: 'spaces',
    icon: 'Sofa',
    confirmed: true,
  },
  {
    id: 'large-windows',
    label: 'Grandes ventanales',
    description: 'Vistas abiertas al parque.',
    category: 'comfort',
    icon: 'PanelTop',
    confirmed: true,
  },
  {
    id: 'wooded-park',
    label: 'Amplio parque arbolado',
    category: 'outdoors',
    icon: 'Trees',
    featured: true,
    confirmed: true,
  },
  {
    id: 'creek',
    label: 'Arroyo',
    description: 'El arroyo atraviesa el entorno de La Arbolada.',
    category: 'outdoors',
    icon: 'Waves',
    featured: true,
    confirmed: true,
  },
  {
    id: 'patio',
    label: 'Patio y espacios exteriores',
    category: 'outdoors',
    icon: 'Sun',
    confirmed: true,
  },
  {
    id: 'barbecue',
    label: 'Parrilla',
    description: 'Disponible para uso de los huéspedes.',
    category: 'outdoors',
    icon: 'Utensils',
    confirmed: true,
  },
  {
    id: 'clay-oven',
    label: 'Horno de barro',
    description: 'Disponible para uso de los huéspedes.',
    category: 'outdoors',
    icon: 'Flame',
    confirmed: true,
  },
  {
    id: 'parking',
    label: 'Amplio estacionamiento interno',
    category: 'outdoors',
    icon: 'Car',
    featured: true,
    confirmed: true,
  },
  {
    id: 'private-access',
    label: 'Acceso privado',
    category: 'spaces',
    icon: 'KeyRound',
    confirmed: true,
  },
];

export const featuredAmenities: AmenityFeature[] = [
  {
    id: 'warm-interiors',
    label: 'Interiores cálidos y confortables',
    description: 'Calefacción por radiadores y hogar a leña para disfrutar todo el año.',
    amenityIds: ['radiator-heating', 'wood-fireplace'],
    imageId: 'casa-livingcasa',
    size: 'wide',
  },
  {
    id: 'connected-stay',
    label: 'Conectividad cuando la necesitás',
    description: 'Wi-Fi y Smart TV incluidos.',
    amenityIds: ['wifi', 'smart-tv'],
    imageId: 'casa-livingcasa3',
    size: 'standard',
  },
  {
    id: 'outdoor-cooking',
    label: 'Parrilla y horno de barro',
    description: 'Ambos están disponibles para uso de los huéspedes.',
    amenityIds: ['barbecue', 'clay-oven'],
    imageId: 'casa-patio4',
    size: 'tall',
  },
  {
    id: 'park-and-creek',
    label: 'Parque arbolado y arroyo',
    description: 'Un gran entorno natural atravesado por el agua.',
    amenityIds: ['wooded-park', 'creek'],
    imageId: 'casa-patio8',
    size: 'wide',
  },
  {
    id: 'parking-feature',
    label: 'Llegada cómoda',
    description: 'Amplio estacionamiento dentro de la propiedad.',
    amenityIds: ['parking'],
    imageId: 'casa-fachada1',
    size: 'standard',
  },
  {
    id: 'included-comforts',
    label: 'Ropa de cama y toallas incluidas',
    description: 'Todo lo esencial listo para la estadía.',
    amenityIds: ['linen', 'towels'],
    imageId: 'casa-dorm1casa2',
    size: 'standard',
  },
  {
    id: 'independent-feature',
    label: 'Alojamiento independiente',
    description: '1 habitación con 3 camas, baño, sala de estar, cocina y acceso propios.',
    amenityIds: ['independent-accommodation', 'private-access'],
    imageId: 'departamento-verdedpto1',
    size: 'wide',
  },
];

export const supportingAmenityIds = [
  'equipped-kitchen',
  'wood-fireplace',
  'large-windows',
  'living-dining',
  'patio',
  'private-access',
  'wifi',
  'smart-tv',
  'linen',
  'towels',
  'barbecue',
  'clay-oven',
  'parking',
] as const;
