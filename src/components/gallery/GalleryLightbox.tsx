import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { CuratedImage } from '@/data/journeys';

type Props = {
  images: CuratedImage[];
  selected: CuratedImage | null;
  onOpenChange: (open: boolean) => void;
};

export function GalleryLightbox({ images, selected, onOpenChange }: Props) {
  const [index, setIndex] = useState(0);
  const dragRef = useRef<{ id: number; x: number; time: number } | null>(null);
  const open = selected !== null;

  useEffect(() => {
    if (!selected) return;
    const nextIndex = images.findIndex((image) => image.id === selected.id);
    setIndex(Math.max(nextIndex, 0));
  }, [images, selected]);

  const image = images[index] ?? selected;
  const go = (step: number) => {
    if (!images.length) return;
    setIndex((current) => (current + step + images.length) % images.length);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, images.length]);

  useEffect(() => {
    if (!image || images.length < 2) return;
    [-1, 1].forEach((step) => {
      const adjacent = images[(index + step + images.length) % images.length];
      const preload = new Image();
      preload.src = adjacent.sources.large ?? adjacent.sources.desktop;
    });
  }, [image, images, index]);

  if (!image) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="gallery-dialog__overlay" />
        <Dialog.Content className="gallery-dialog__content" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{image.alt}</Dialog.Title>
          <div className="gallery-dialog__top">
            <span>
              {image.property === 'casa' ? 'Residencia principal' : 'Departamento independiente'}
            </span>
            <Dialog.Close asChild>
              <button type="button" className="gallery-dialog__close" aria-label="Cerrar galería">
                <X size={23} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div
            className="gallery-dialog__media"
            onPointerDown={(event) => {
              if (dragRef.current) return;
              dragRef.current = { id: event.pointerId, x: event.clientX, time: performance.now() };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.id !== event.pointerId) return;
              const distance = event.clientX - drag.x;
              const velocity = Math.abs(distance) / Math.max(performance.now() - drag.time, 1);
              dragRef.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              if (Math.abs(distance) > 44 || velocity > 0.42) go(distance < 0 ? 1 : -1);
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            <img
              key={image.id}
              data-image-id={image.id}
              src={image.sources.large ?? image.sources.desktop}
              srcSet={`${image.sources.mobile} 840w, ${image.sources.desktop} 1280w${image.sources.large ? `, ${image.sources.large} 1920w` : ''}`}
              sizes="100vw"
              alt={image.alt}
              decoding="async"
            />
          </div>

          <div className="gallery-dialog__bottom">
            <button type="button" onClick={() => go(-1)} aria-label="Imagen anterior">
              <ArrowLeft size={21} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <div>
              <small>
                {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </small>
            </div>
            <button type="button" onClick={() => go(1)} aria-label="Imagen siguiente">
              <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
