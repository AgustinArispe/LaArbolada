import { propertyImages } from '@/data/images.generated';

export type { FocalPoint, PropertyImage } from '@/data/images.generated';
export { propertyImages };

export const casaImages = propertyImages.filter((image) => image.property === 'casa');
export const departamentoImages = propertyImages.filter(
  (image) => image.property === 'departamento',
);
