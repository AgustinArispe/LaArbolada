import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Maximize2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { GalleryLightbox } from '@/components/gallery/GalleryLightbox';
import { GalleryNavigationButton } from '@/components/gallery/GalleryNavigationButton';
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
      sizes="(max-width: 767px) calc(100vw - 2.5rem), min(78vw, 1380px)"
      alt={alt}
      draggable={false}
      loading="lazy"
      decoding="async"
      onDragStart={(event) => event.preventDefault()}
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
  const [displayIndex, setDisplayIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<CuratedImage | null>(null);
  const currentRef = useRef(0);
  const endTimerRef = useRef<number | null>(null);
  const counterTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: number; x: number; time: number } | null>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reducedMotion = useReducedMotion();
  const instanceId = useId();

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (images.length < 2) return;
    [currentIndex - 1, currentIndex + 1].forEach((index) => {
      const adjacent = images[(index + images.length) % images.length];
      const preload = new Image();
      preload.src = adjacent.sources.desktop;
    });
  }, [currentIndex, images]);

  useEffect(() => {
    thumbnailRefs.current[displayIndex]?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [displayIndex, reducedMotion]);

  useEffect(
    () => () => {
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
      if (counterTimerRef.current) window.clearTimeout(counterTimerRef.current);
    },
    [],
  );

  if (!images.length) return null;

  const current = images[currentIndex];
  const outgoing = outgoingIndex === null ? null : images[outgoingIndex];
  const duration = reducedMotion ? 220 : mobile ? 500 : 660;
  const progress = (displayIndex + 1) / images.length;

  const changeTo = (next: number, directionHint: number) => {
    if (transitioning || images.length < 2) return;
    const normalized = (next + images.length) % images.length;
    if (normalized === currentRef.current) return;

    setDirection(directionHint);
    setOutgoingIndex(currentRef.current);
    setCurrentIndex(normalized);
    currentRef.current = normalized;
    setTransitioning(true);

    if (counterTimerRef.current) window.clearTimeout(counterTimerRef.current);
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    counterTimerRef.current = window.setTimeout(() => setDisplayIndex(normalized), duration * 0.46);
    endTimerRef.current = window.setTimeout(() => {
      setOutgoingIndex(null);
      setTransitioning(false);
      setDisplayIndex(normalized);
    }, duration);
  };

  const go = (step: number) => changeTo(currentRef.current + step, step);
  const disabled = !hydrated || transitioning || images.length < 2;

  return (
    <>
      <div
        id={id}
        className="horizontal-gallery"
        role="region"
        aria-roledescription="carrusel"
        aria-label={`${room}, ${property === 'casa' ? 'casa principal' : 'alojamiento independiente'}`}
        data-property={property}
        data-room={room}
        data-gallery-index={currentIndex + 1}
        data-gallery-total={images.length}
        data-transitioning={transitioning ? 'true' : 'false'}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') go(-1);
          if (event.key === 'ArrowRight') go(1);
        }}
      >
        <div
          className="horizontal-gallery__frame"
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest('button') || dragRef.current) return;
            dragRef.current = { id: event.pointerId, x: event.clientX, time: performance.now() };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.id !== event.pointerId) return;
            const distance = event.clientX - drag.x;
            const velocity = Math.abs(distance) / Math.max(performance.now() - drag.time, 1);
            dragRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
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
              outgoing && (mobile || reducedMotion)
                ? reducedMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      clipPath: direction > 0 ? 'inset(0 12% 0 88%)' : 'inset(0 88% 0 12%)',
                      scale: 0.985,
                    }
                : false
            }
            animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)', scale: 1 }}
            transition={{ duration: duration / 1000, ease: [0.23, 1, 0.32, 1] }}
          >
            <ResponsiveImage
              image={current}
              alt={current.alt}
              className="horizontal-gallery__image"
            />
          </motion.div>

          {outgoing && (mobile || reducedMotion) && (
            <motion.div
              key={`${instanceId}-${outgoing.id}-crossfade`}
              className="horizontal-gallery__crossfade"
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: reducedMotion ? 1 : 0.985 }}
              transition={{ duration: duration / 1000, ease: [0.23, 1, 0.32, 1] }}
              aria-hidden="true"
            >
              <ResponsiveImage image={outgoing} alt="" />
            </motion.div>
          )}

          {outgoing && !mobile && !reducedMotion && (
            <div
              key={`${instanceId}-${outgoing.id}-split`}
              className="horizontal-gallery__split"
              aria-hidden="true"
            >
              <motion.div
                className="horizontal-gallery__half horizontal-gallery__half--top"
                initial={{ x: '0%' }}
                animate={{ x: direction > 0 ? '-101%' : '101%' }}
                transition={{ duration: 0.66, ease: [0.77, 0, 0.175, 1] }}
              >
                <ResponsiveImage image={outgoing} alt="" />
              </motion.div>
              <motion.div
                className="horizontal-gallery__half horizontal-gallery__half--bottom"
                initial={{ x: '0%' }}
                animate={{ x: direction > 0 ? '101%' : '-101%' }}
                transition={{ duration: 0.66, ease: [0.77, 0, 0.175, 1] }}
              >
                <ResponsiveImage image={outgoing} alt="" />
              </motion.div>
            </div>
          )}
        </div>

        <div className="horizontal-gallery__controls">
          <div className="horizontal-gallery__controls-main">
            <GalleryNavigationButton
              direction="previous"
              disabled={disabled}
              onClick={() => go(-1)}
            />
            <div className="horizontal-gallery__status" aria-live="polite" aria-atomic="true">
              <span>
                {String(displayIndex + 1).padStart(2, '0')} /{' '}
                {String(images.length).padStart(2, '0')}
              </span>
              <i aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
            </div>
            <GalleryNavigationButton direction="next" disabled={disabled} onClick={() => go(1)} />
          </div>
          <button
            type="button"
            className="horizontal-gallery__fullscreen gallery-navigation-button"
            onClick={() => setSelected(current)}
            disabled={!hydrated}
            aria-label={`Abrir ${room} en pantalla completa`}
          >
            <Maximize2 size={21} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        {images.length > 1 && (
          <div className="horizontal-gallery__thumbnails" aria-label={`Fotografías de ${room}`}>
            {images.map((image, index) => (
              <button
                key={image.id}
                ref={(node) => {
                  thumbnailRefs.current[index] = node;
                }}
                type="button"
                className={index === displayIndex ? 'is-active' : ''}
                onClick={() => changeTo(index, index > currentRef.current ? 1 : -1)}
                disabled={!hydrated || transitioning}
                aria-label={`Ver fotografía ${index + 1} de ${images.length}`}
                aria-current={index === displayIndex ? 'true' : undefined}
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
