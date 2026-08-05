import {
  propertyImages as originalPropertyImages,
  type PropertyImage,
} from '@/data/images.generated';
import photoProcessingConfig from '../../photo-processing/config.json';
import geminiReviewManifest from './gemini-review-manifest.json';
import { isGeminiReviewBuild, selectGeminiReviewImages } from './image-set.mjs';

export type { PropertyImage } from '@/data/images.generated';

const useProcessedImages = import.meta.env.PUBLIC_IMAGE_SET === 'processed';
const useGeminiReviewImages = isGeminiReviewBuild(import.meta.env.PUBLIC_IMAGE_SET);
const lockedImageIds = new Set(photoProcessingConfig.lockedImages.map((image) => image.id));

function processedSources(image: PropertyImage): PropertyImage['sources'] {
  const base = `/images-processed/${image.property}/${image.id}`;
  return {
    thumbnail: `${base}-thumbnail.webp`,
    mobile: `${base}-mobile.webp`,
    desktop: `${base}-desktop.webp`,
    large: `${base}-large.webp`,
  };
}

export const propertyImages: PropertyImage[] = useProcessedImages
  ? originalPropertyImages.map((image) =>
      lockedImageIds.has(image.id) ? image : { ...image, sources: processedSources(image) },
    )
  : useGeminiReviewImages
    ? selectGeminiReviewImages(originalPropertyImages, geminiReviewManifest, lockedImageIds)
    : originalPropertyImages;

export const casaImages = propertyImages.filter((image) => image.property === 'casa');
export const departamentoImages = propertyImages.filter(
  (image) => image.property === 'departamento',
);
