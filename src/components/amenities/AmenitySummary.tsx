import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

const summary = [
  { value: 4, label: 'habitaciones', context: 'Casa principal' },
  { value: 7, label: 'camas', context: 'Casa principal' },
  { value: 8, label: 'personas', context: 'Capacidad de la casa' },
  { value: 1, label: 'habitación · 3 camas', context: 'Alojamiento independiente' },
];

function SummaryNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 680;
        const tick = (time: number) => {
          const progress = Math.min((time - start) / duration, 1);
          node.textContent = String(Math.round(value * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, value]);

  return <span ref={ref}>{value}</span>;
}

export function AmenitySummary() {
  return (
    <div className="amenity-summary" aria-label="Resumen de capacidad de la propiedad">
      {summary.map((item) => (
        <div key={item.label} className="amenity-summary__item">
          <strong>
            <SummaryNumber value={item.value} />
          </strong>
          <span>{item.label}</span>
          <small>{item.context}</small>
        </div>
      ))}
    </div>
  );
}
