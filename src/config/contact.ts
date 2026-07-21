export const contact = {
  whatsappNumber: '5492494567808',
  whatsappMessage: 'Hola, quisiera consultar disponibilidad en Casa La Arbolada.',
  location: 'Tandil, Buenos Aires',
} as const;

export const whatsappUrl = `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(contact.whatsappMessage)}`;
