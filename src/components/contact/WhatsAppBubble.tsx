import { useEffect, useState } from 'react';
import { whatsappUrl } from '@/config/contact';
import { WhatsAppIcon } from '@/components/contact/WhatsAppIcon';

export function WhatsAppBubble() {
  const [blockedByAction, setBlockedByAction] = useState(false);

  useEffect(() => {
    const protectedActions = document.querySelectorAll(
      '.booking-action--primary, .horizontal-gallery__controls',
    );
    if (!protectedActions.length) return;
    const visibleActions = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleActions.add(entry.target);
          else visibleActions.delete(entry.target);
        });
        setBlockedByAction(visibleActions.size > 0);
      },
      { threshold: [0, 0.7, 1], rootMargin: '80px 0px 80px 0px' },
    );
    protectedActions.forEach((action) => observer.observe(action));
    return () => observer.disconnect();
  }, []);

  return (
    <a
      className={`whatsapp-bubble${blockedByAction ? ' is-contact-action-visible' : ''}`}
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar disponibilidad por WhatsApp"
      aria-hidden={blockedByAction ? 'true' : undefined}
      aria-describedby="whatsapp-bubble-tooltip"
      tabIndex={blockedByAction ? -1 : undefined}
    >
      <WhatsAppIcon size={30} />
      <span id="whatsapp-bubble-tooltip">
        Consultar disponibilidad
      </span>
    </a>
  );
}
