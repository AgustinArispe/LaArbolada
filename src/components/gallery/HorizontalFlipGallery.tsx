import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Maximize2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { GalleryLightbox } from '@/components/gallery/GalleryLightbox';
import type { CuratedImage } from '@/data/journeys';

type Props = {
  id: string;
  property: 'casa' | 'departamento';
  room: string;
  images: CuratedImage[];
};

function ResponsiveImage({
  image,
  alt,
  className,
}: {
  image: CuratedImage;
  alt: string;
  className?: string;
}) {
  return (
    <img
      className={className}
      data-image-id={image.id}
      data-image-room={image.room}
      src={image.sources.desktop}
      srcSet={`${image.sources.mobile} 900w, ${image.sources.desktop} 1600w${image.sources.large ? `, ${image.sources.large} 2400w` : ''}`}
      sizes="(max-width: 767px) calc(100vw - 2rem), min(78vw, 1380px)"
      alt={alt}
      loading="lazy"
      decoding="async"
      style={
        {
          '--gallery-focal-desktop': `${image.focalPoint?.desktop.x ?? 50}% ${image.focalPoint?.desktop.y ?? 50}%`,
          '--gallery-focal-mobile': `${image.focalPoint?.mobile.x ?? 50}% ${image.focalPoint?.mobile.y ?? 50}%`,
        } as CSSProperties
      }
    />
  );
}

export function HorizontalFlipGallery({ id, property, room, images }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [mobileFallback, setMobileFallback] = useState(false);
  const [selected, setSelected] = useState<CuratedImage | null>(null);
  const currentRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: number; x: number; time: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const instanceId = useId();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileFallback(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (images.length < 2) return;
    [currentIndex - 1, currentIndex + 1].forEach((index) => {
      const image = images[(index + images.length) % images.length];
      const preload = new Image();
      preload.src = image.sources.desktop;
    });
  }, [currentIndex, images]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  if (!images.length) return null;

  const current = images[currentIndex];
  const outgoing = outgoingIndex === null ? null : images[outgoingIndex];
  const progress = (currentIndex + 1) / images.length;
  const useFallback = reducedMotion || mobileFallback;

  const changeTo = (next: number, directionHint: number) => {
    if (transitioning || images.length < 2) return;
    const normalized = (next + images.length) % images.length;
    if (normalized === currentRef.current) return;

    setDirection(directionHint);
    setOutgoingIndex(currentRef.current);
    setCurrentIndex(normalized);
    currentRef.current = normalized;
    setTransitioning(true);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => {
        setOutgoingIndex(null);
        setTransitioning(false);
      },
      reducedMotion ? 220 : mobileFallback ? 540 : 680,
    );
  };

  const go = (step: number) => changeTo(currentRef.current + step, step);

  return (
    <>
      <div
        id={id}
        className="horizontal-gallery"
        role="region"
        aria-roledescription="carrusel"
        aria-label={`${room} de ${property === 'casa' ? 'la casa principal' : 'el alojamiento independiente'}`}
        data-property={property}
        data-room={room}
        data-gallery-index={currentIndex + 1}
        data-gallery-total={images.length}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') go(-1);
          if (event.key === 'ArrowRight') go(1);
        }}
      >
        <div
          className="horizontal-gallery__frame"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('button')) return;
            if (dragRef.current) return;
            dragRef.current = { id: event.pointerId, x: event.clientX, time: performance.now() };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.id !== event.pointerId) return;
            const distance = event.clientX - drag.x;
            const elapsed = Math.max(performance.now() - drag.time, 1);
            const velocity = Math.abs(distance) / elapsed;
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
          <motion.div
            key={`${instanceId}-${current.id}`}
            className="horizontal-gallery__current"
            initial={
              outgoing && useFallback
                ? { opacity: 0, clipPath: 'inset(49% 0 49% 0)', transform: 'scale(0.985)' }
                : false
            }
            animate={{ opacity: 1, clipPath: 'inset(0% 0 0% 0)', transform: 'scale(1)' }}
            transition={{ duration: reducedMotion ? 0.2 : 0.52, ease: [0.23, 1, 0.32, 1] }}
          >
            <ResponsiveImage
              image={current}
              alt={current.alt}
              className="horizontal-gallery__image"
            />
          </motion.div>

          {outgoing &&
            (useFallback ? (
              <motion.div
                key={`${instanceId}-${outgoing.id}-fallback`}
                className="horizontal-gallery__crossfade"
                initial={{ opacity: 1, transform: 'scale(1)' }}
                animate={{ opacity: 0, transform: 'scale(0.985)' }}
                transition={{ duration: reducedMotion ? 0.2 : 0.5, ease: [0.23, 1, 0.32, 1] }}
                aria-hidden="true"
              >
                <ResponsiveImage image={outgoing} alt="" />
              </motion.div>
            ) : (
              <div
                key={`${instanceId}-${outgoing.id}-split`}
                className="horizontal-gallery__split"
                aria-hidden="true"
              >
                <motion.div
                  className="horizontal-gallery__half horizontal-gallery__half--top"
                  initial={{ transform: 'rotateX(0deg)', opacity: 1 }}
                  animate={{
                    transform: `rotateX(${direction > 0 ? -88 : 88}deg)`,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.46, delay: 0.08, ease: [0.77, 0, 0.175, 1] }}
                >
                  <ResponsiveImage image={outgoing} alt="" />
                </motion.div>
                <motion.div
                  className="horizontal-gallery__half horizontal-gallery__half--bottom"
                  initial={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
                  animate={{ clipPath: 'inset(100% 0 0 0)', opacity: 0.08 }}
                  transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ResponsiveImage image={outgoing} alt="" />
                </motion.div>
              </div>
            ))}

          <button
            type="button"
            className="horizontal-gallery__fullscreen"
            onClick={() => setSelected(current)}
            disabled={!hydrated}
            aria-label={`Abrir ${room} en pantalla completa`}
          >
            <Maximize2 size={20} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        <div className="horizontal-gallery__controls">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={!hydrated || transitioning || images.length < 2}
            aria-label="Fotografía anterior"
          >
            <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>Anterior</span>
          </button>
          <div className="horizontal-gallery__status" aria-live="polite" aria-atomic="true">
            <span>
              {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
            </span>
            <i aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={!hydrated || transitioning || images.length < 2}
            aria-label="Fotografía siguiente"
          >
            <span>Siguiente</span>
            <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        {images.length > 3 && (
          <div className="horizontal-gallery__thumbnails" aria-label={`Fotografías de ${room}`}>
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                className={index === currentIndex ? 'is-active' : ''}
                onClick={() => changeTo(index, index > currentIndex ? 1 : -1)}
                disabled={!hydrated || transitioning}
                aria-label={`Ver fotografía ${index + 1} de ${images.length}`}
                aria-current={index === currentIndex ? 'true' : undefined}
              >
                <img src={image.sources.thumbnail} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
      </div>

      <GalleryLightbox
        images={images}
        selected={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
