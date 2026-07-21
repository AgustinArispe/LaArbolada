import { AmenityCard, SupportingAmenity } from '@/components/amenities/AmenityCard';
import { AmenitySummary } from '@/components/amenities/AmenitySummary';
import { amenities, featuredAmenities, supportingAmenityIds } from '@/data/amenities';
import { propertyImages } from '@/data/images.generated';

const imageById = new Map(propertyImages.map((image) => [image.id, image]));
const amenityById = new Map(amenities.map((amenity) => [amenity.id, amenity]));

export function AmenitiesGrid() {
  return (
    <div className="amenities-grid">
      <AmenitySummary />

      <div className="amenities-featured" aria-label="Comodidades destacadas">
        {featuredAmenities.map((feature) => {
          const image = imageById.get(feature.imageId);
          return image ? <AmenityCard key={feature.id} feature={feature} image={image} /> : null;
        })}
      </div>

      <div className="amenities-services">
        <div className="amenities-services__heading">
          <p>Incluido en tu estadía</p>
          <h3>Confort en el interior y al aire libre</h3>
        </div>
        <ul>
          {supportingAmenityIds.map((id) => {
            const amenity = amenityById.get(id);
            return amenity ? <SupportingAmenity key={id} amenity={amenity} /> : null;
          })}
        </ul>
      </div>
    </div>
  );
}
