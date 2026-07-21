import { MessageCircle } from 'lucide-react';
import { whatsappUrl } from '@/config/contact';

export function WhatsAppBubble() {
  return (
    <a
      className="whatsapp-bubble"
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar disponibilidad por WhatsApp"
    >
      <MessageCircle size={25} strokeWidth={1.7} aria-hidden="true" />
      <span>Consultar por WhatsApp</span>
    </a>
  );
}
