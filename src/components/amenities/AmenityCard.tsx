import {
  Bath,
  Bed,
  BedDouble,
  Car,
  CookingPot,
  Flame,
  House,
  KeyRound,
  PanelTop,
  Sofa,
  Sun,
  ThermometerSun,
  Trees,
  Tv,
  Utensils,
  Users,
  Waves,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import type { Amenity, AmenityFeature } from '@/data/amenities';
import type { PropertyImage } from '@/data/images.generated';

const iconMap: Record<string, LucideIcon> = {
  Bath,
  Bed,
  BedDouble,
  Car,
  CookingPot,
  Flame,
  House,
  KeyRound,
  PanelTop,
  Sofa,
  Sun,
  ThermometerSun,
  Trees,
  Tv,
  Utensils,
  Users,
  Waves,
  Wifi,
};

export function AmenityIcon({ name, size = 25 }: { name: string; size?: number }) {
  const Icon = iconMap[name] ?? House;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export function AmenityCard({ feature, image }: { feature: AmenityFeature; image: PropertyImage }) {
  return (
    <article className={`amenity-feature amenity-feature--${feature.size}`}>
      <img
        src={image.sources.desktop}
        srcSet={`${image.sources.mobile} 900w, ${image.sources.desktop} 1600w${image.sources.large ? `, ${image.sources.large} 2400w` : ''}`}
        sizes="(max-width: 767px) calc(100vw - 2.5rem), (max-width: 1199px) 48vw, 38vw"
        alt=""
        loading="lazy"
        decoding="async"
      />
      <div className="amenity-feature__shade" aria-hidden="true" />
      <div className="amenity-feature__copy">
        <h3>{feature.label}</h3>
        <p>{feature.description}</p>
      </div>
    </article>
  );
}

export function SupportingAmenity({ amenity }: { amenity: Amenity }) {
  return (
    <li className="supporting-amenity">
      <AmenityIcon name={amenity.icon} />
      <span>{amenity.label}</span>
    </li>
  );
}
