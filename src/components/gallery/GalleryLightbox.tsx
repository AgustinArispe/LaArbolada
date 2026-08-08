import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { CuratedImage } from '@/data/journeys';

type Props = {
  images: CuratedImage[];
  selected: CuratedImage | null;
  onOpenChange: (open: boolean) => void;
};

type Point = { x: number; y: number };
type Gesture = {
  points: Map<number, Point>;
  startScale: number;
  startPosition: Point;
  startDistance: number;
  startMidpoint: Point;
  moved: boolean;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function GalleryLightbox({ images, selected, onOpenChange }: Props) {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(MIN_ZOOM);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const mediaRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const historyEntryRef = useRef(false);
  const closingFromUiRef = useRef(false);
  const open = selected !== null;

  const resetZoom = () => {
    setScale(MIN_ZOOM);
    setPosition({ x: 0, y: 0 });
    gestureRef.current = null;
  };

  useEffect(() => {
    if (!selected) return;
    const nextIndex = images.findIndex((image) => image.id === selected.id);
    setIndex(Math.max(nextIndex, 0));
    resetZoom();
  }, [images, selected]);

  const image = images[index] ?? selected;
  const go = (step: number) => {
    if (!images.length) return;
    setIndex((current) => (current + step + images.length) % images.length);
    resetZoom();
  };

  const requestClose = () => {
    resetZoom();
    if (historyEntryRef.current) {
      closingFromUiRef.current = true;
      historyEntryRef.current = false;
      window.history.back();
    }
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ ...window.history.state, galleryLightbox: true }, '');
    historyEntryRef.current = true;
    const onPopState = () => {
      if (closingFromUiRef.current) {
        closingFromUiRef.current = false;
        return;
      }
      historyEntryRef.current = false;
      resetZoom();
      onOpenChange(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [open, onOpenChange]);

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

  const constrainPosition = (next: Point, nextScale: number): Point => {
    const rect = mediaRef.current?.getBoundingClientRect();
    if (!rect || nextScale <= MIN_ZOOM) return { x: 0, y: 0 };
    const maxX = (rect.width * (nextScale - 1)) / 2;
    const maxY = (rect.height * (nextScale - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  };

  const isOnImage = (point: Point) => {
    const container = mediaRef.current?.getBoundingClientRect();
    if (!container || !image) return false;
    const imageRatio = image.width / image.height;
    const containerRatio = container.width / container.height;
    const width = imageRatio > containerRatio ? container.width : container.height * imageRatio;
    const height = imageRatio > containerRatio ? container.width / imageRatio : container.height;
    const left = container.left + (container.width - width) / 2;
    const top = container.top + (container.height - height) / 2;
    return point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height;
  };

  if (!image) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && requestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="gallery-dialog__overlay" />
        <Dialog.Content className="gallery-dialog__content" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{image.alt}</Dialog.Title>
          <div className="gallery-dialog__top">
            <span>{image.property === 'casa' ? 'Residencia principal' : 'Departamento independiente'}</span>
            <button type="button" className="gallery-dialog__close" onClick={requestClose} aria-label="Cerrar galería">
              <X size={23} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <div
            ref={mediaRef}
            className="gallery-dialog__media"
            onWheel={(event) => {
              event.preventDefault();
              const delta = event.deltaY < 0 ? 0.18 : -0.18;
              const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale + delta));
              setScale(nextScale);
              setPosition((current) => constrainPosition(current, nextScale));
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              const point = { x: event.clientX, y: event.clientY };
              const previous = gestureRef.current;
              const points = previous?.points ?? new Map<number, Point>();
              points.set(event.pointerId, point);
              const values = [...points.values()];
              gestureRef.current = {
                points,
                startScale: scale,
                startPosition: position,
                startDistance: values.length > 1 ? distance(values[0], values[1]) : 0,
                startMidpoint: values.length > 1 ? midpoint(values[0], values[1]) : point,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              const gesture = gestureRef.current;
              if (!gesture || !gesture.points.has(event.pointerId)) return;
              gesture.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
              const points = [...gesture.points.values()];
              if (points.length > 1) {
                const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, gesture.startScale * (distance(points[0], points[1]) / gesture.startDistance)));
                setScale(nextScale);
                gesture.moved = true;
              } else if (gesture.startScale > MIN_ZOOM) {
                const point = points[0];
                const next = constrainPosition({ x: gesture.startPosition.x + point.x - gesture.startMidpoint.x, y: gesture.startPosition.y + point.y - gesture.startMidpoint.y }, scale);
                setPosition(next);
                gesture.moved = true;
              }
            }}
            onPointerUp={(event) => {
              const gesture = gestureRef.current;
              if (!gesture) return;
              const point = { x: event.clientX, y: event.clientY };
              const wasTap = !gesture.moved && gesture.points.size === 1;
              gesture.points.delete(event.pointerId);
              if (!gesture.points.size) gestureRef.current = null;
              if (wasTap && !isOnImage(point)) requestClose();
            }}
            onPointerCancel={() => {
              gestureRef.current = null;
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
              draggable={false}
              style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})` }}
            />
          </div>

          <div className="gallery-dialog__bottom">
            <button type="button" onClick={() => go(-1)} aria-label="Imagen anterior"><ArrowLeft size={21} strokeWidth={1.5} aria-hidden="true" /></button>
            <div><small>{String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</small></div>
            <button type="button" onClick={() => go(1)} aria-label="Imagen siguiente"><ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
