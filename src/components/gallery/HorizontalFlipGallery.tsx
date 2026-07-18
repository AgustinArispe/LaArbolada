import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
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
      sizes="(max-width: 767px) 100vw, min(90vw, 1500px)"
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}

export function HorizontalFlipGallery({ id, property, room, images }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const currentRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: number; x: number; time: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const instanceId = useId();

  useEffect(() => {
    if (images.length < 2) return;
    [currentIndex - 1, currentIndex, currentIndex + 1].forEach((index) => {
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
      reducedMotion ? 220 : 660,
    );
  };

  const go = (step: number) => changeTo(currentRef.current + step, step);

  return (
    <div
      id={id}
      className="horizontal-gallery"
      role="region"
      aria-roledescription="carrusel"
      aria-label={`${room} de ${property === 'casa' ? 'la casa' : 'el departamento'}`}
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
        <ResponsiveImage image={current} alt={current.alt} className="horizontal-gallery__image" />

        {outgoing &&
          (reducedMotion ? (
            <motion.div
              key={`${instanceId}-${outgoing.id}`}
              className="horizontal-gallery__crossfade"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              aria-hidden="true"
            >
              <ResponsiveImage image={outgoing} alt="" />
            </motion.div>
          ) : (
            <div
              key={`${instanceId}-${outgoing.id}`}
              className="horizontal-gallery__flip"
              aria-hidden="true"
            >
              <motion.div
                className="horizontal-gallery__half horizontal-gallery__half--top"
                initial={{ transform: 'rotateX(0deg)', opacity: 1 }}
                animate={{
                  transform: `translateY(-2.5%) rotateX(${direction > 0 ? -42 : 42}deg)`,
                  opacity: 0,
                }}
                transition={{ duration: 0.62, ease: [0.77, 0, 0.175, 1] }}
              >
                <ResponsiveImage image={outgoing} alt="" />
              </motion.div>
              <motion.div
                className="horizontal-gallery__half horizontal-gallery__half--bottom"
                initial={{ transform: 'rotateX(0deg)', opacity: 1 }}
                animate={{
                  transform: `translateY(2.5%) rotateX(${direction > 0 ? 42 : -42}deg)`,
                  opacity: 0,
                }}
                transition={{ duration: 0.62, ease: [0.77, 0, 0.175, 1] }}
              >
                <ResponsiveImage image={outgoing} alt="" />
              </motion.div>
            </div>
          ))}
      </div>

      <div className="horizontal-gallery__controls">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={transitioning || images.length < 2}
          aria-label="Fotografía anterior"
        >
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden="true" />
          <span>Anterior</span>
        </button>
        <div className="horizontal-gallery__status" aria-live="polite" aria-atomic="true">
          <span>
            {currentIndex + 1} de {images.length}
          </span>
          <i aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={transitioning || images.length < 2}
          aria-label="Fotografía siguiente"
        >
          <span>Siguiente</span>
          <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
