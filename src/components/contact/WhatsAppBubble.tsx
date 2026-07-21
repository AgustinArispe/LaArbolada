import { useEffect, useState } from 'react';
import { whatsappUrl } from '@/config/contact';
import { WhatsAppIcon } from '@/components/contact/WhatsAppIcon';

export function WhatsAppBubble() {
  const [contactActionVisible, setContactActionVisible] = useState(false);

  useEffect(() => {
    const contactAction = document.querySelector('.contact-panel__action--primary');
    if (!contactAction) return;
    const observer = new IntersectionObserver(
      ([entry]) => setContactActionVisible(entry.isIntersecting && entry.intersectionRatio >= 0.7),
      { threshold: [0, 0.7, 1] },
    );
    observer.observe(contactAction);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      className={`whatsapp-bubble${contactActionVisible ? ' is-contact-action-visible' : ''}`}
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar disponibilidad por WhatsApp"
      aria-hidden={contactActionVisible ? 'true' : undefined}
      aria-describedby="whatsapp-bubble-tooltip"
      tabIndex={contactActionVisible ? -1 : undefined}
    >
      <WhatsAppIcon size={30} />
      <span id="whatsapp-bubble-tooltip" role="tooltip">
        Consultar disponibilidad por WhatsApp
      </span>
    </a>
  );
}
