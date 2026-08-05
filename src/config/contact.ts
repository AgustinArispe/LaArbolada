export const contact = {
  whatsappNumber: '5492494567808',
  whatsappMessage: 'Hola, quisiera consultar disponibilidad en La Arbolada.',
  location: 'Tandil, Buenos Aires',
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=La+Arbolada%2C+Tandil%2C+Buenos+Aires',
} as const;

export const whatsappUrl = `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(contact.whatsappMessage)}`;
