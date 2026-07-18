import { useMemo, useState } from 'react';
import type { CuratedImage, PropertyKey } from '@/data/journeys';
import { GalleryLightbox } from '@/components/gallery/GalleryLightbox';

export type GalleryGroup = {
  room: string;
  anchor: string;
  images: CuratedImage[];
};

type Props = {
  casa: GalleryGroup[];
  departamento: GalleryGroup[];
};

export function SectionedGalleryClient({ casa, departamento }: Props) {
  const [property, setProperty] = useState<PropertyKey>('casa');
  const [selected, setSelected] = useState<CuratedImage | null>(null);
  const groups = property === 'casa' ? casa : departamento;
  const images = useMemo(() => groups.flatMap((group) => group.images), [groups]);

  return (
    <div className="sectioned-gallery">
      <div className="sectioned-gallery__switch" role="group" aria-label="Elegir propiedad">
        <button
          type="button"
          className={property === 'casa' ? 'is-active' : ''}
          onClick={() => {
            setProperty('casa');
            setSelected(null);
          }}
          aria-pressed={property === 'casa'}
        >
          La casa
        </button>
        <button
          type="button"
          className={property === 'departamento' ? 'is-active' : ''}
          onClick={() => {
            setProperty('departamento');
            setSelected(null);
          }}
          aria-pressed={property === 'departamento'}
        >
          El departamento
        </button>
      </div>

      <div className="sectioned-gallery__layout">
        <nav className="sectioned-gallery__index" aria-label="Ambientes de la galería">
          {groups.map((group) => (
            <a key={group.anchor} href={`#${group.anchor}`}>
              {group.room}
            </a>
          ))}
        </nav>

        <div
          key={property}
          className="sectioned-gallery__chapters"
          data-gallery-property={property}
        >
          {groups.map((group) => (
            <section
              key={group.anchor}
              id={group.anchor}
              className="archive-room"
              data-property={property}
              data-room={group.room}
              data-image-ids={JSON.stringify(group.images.map((image) => image.id))}
            >
              <header>
                <h3>{group.room}</h3>
                <span>
                  {group.images.length} {group.images.length === 1 ? 'fotografía' : 'fotografías'}
                </span>
              </header>
              <div className="archive-room__images">
                {group.images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    className={index === 0 && group.images.length > 2 ? 'is-wide' : ''}
                    onClick={() => setSelected(image)}
                    aria-label={`Abrir fotografía: ${image.alt}`}
                    data-image-id={image.id}
                    data-image-room={image.room}
                  >
                    <img
                      src={image.sources.desktop}
                      srcSet={`${image.sources.mobile} 900w, ${image.sources.desktop} 1600w${image.sources.large ? `, ${image.sources.large} 2400w` : ''}`}
                      sizes="(max-width: 767px) 100vw, 72vw"
                      alt={image.alt}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <GalleryLightbox
        images={images}
        selected={selected}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelected(null);
        }}
      />
    </div>
  );
}
