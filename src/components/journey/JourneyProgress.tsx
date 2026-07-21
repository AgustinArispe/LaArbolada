import { useEffect, useRef, useState, type CSSProperties } from 'react';

type RoomLink = {
  id: string;
  title: string;
};

type Props = {
  label: string;
  rooms: RoomLink[];
};

export function JourneyProgress({ label, rooms }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeLinkRef = useRef<HTMLAnchorElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const elements = rooms
      .map((room) => document.getElementById(room.id))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = rooms.findIndex((room) => room.id === visible.target.id);
        if (index >= 0) setCurrentIndex(index);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.01, 0.25, 0.6] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [rooms]);

  useEffect(() => {
    if (window.innerWidth >= 1024) return;
    const nav = navRef.current;
    const active = activeLinkRef.current;
    if (!nav || !active) return;
    nav.scrollTo({
      left: active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [currentIndex]);

  const room = rooms[currentIndex];

  return (
    <aside
      className="journey-progress"
      aria-label={`Índice de ${label}`}
      data-active-room={room?.title}
      data-active-room-number={currentIndex + 1}
      style={{ '--journey-ratio': (currentIndex + 1) / rooms.length } as CSSProperties}
    >
      <p>{label}</p>
      <div
        key={room?.id}
        className="journey-progress__current"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong>
          {String(currentIndex + 1).padStart(2, '0')} de {String(rooms.length).padStart(2, '0')}
        </strong>
        <span>{room?.title}</span>
      </div>
      <div className="journey-progress__line" aria-hidden="true">
        <i />
      </div>
      <nav ref={navRef} aria-label={`Ambientes de ${label}`}>
        {rooms.map((item, index) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            ref={index === currentIndex ? activeLinkRef : undefined}
            className={index === currentIndex ? 'is-active' : ''}
            aria-current={index === currentIndex ? 'location' : undefined}
          >
            {item.title}
          </a>
        ))}
      </nav>
    </aside>
  );
}
