import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';

type PageKind = 'home' | 'property';

type Props = {
  pageKind?: PageKind;
  currentPath?: string;
};

const homeLinks = [
  { href: '/#inicio', label: 'La Arbolada', section: 'inicio' },
  { href: '/#comodidades', label: 'Comodidades', section: 'comodidades' },
  {
    href: '/casa-principal',
    label: 'Residencia principal',
    section: 'casa-principal',
    route: '/casa-principal',
  },
  {
    href: '/alojamiento-independiente',
    label: 'Departamento independiente',
    section: 'alojamiento-independiente',
    route: '/alojamiento-independiente',
  },
  { href: '/#ubicacion', label: 'Ubicación', section: 'ubicacion' },
  { href: '/#contacto', label: 'Contacto', section: 'contacto' },
];

const propertyLinks = [
  { href: '/', label: 'La Arbolada', section: 'inicio', route: '/' },
  { href: '#espacios', label: 'Espacios', section: 'espacios' },
  { href: '#comodidades', label: 'Comodidades', section: 'comodidades' },
  { href: '#galeria', label: 'Galería', section: 'galeria' },
  { href: '#contacto', label: 'Consultar', section: 'contacto' },
];

type NavTheme = 'photo' | 'light' | 'dark';

function sectionAtViewport() {
  const sampleY = Math.min(window.innerHeight * 0.35, 320);
  return document
    .elementsFromPoint(window.innerWidth / 2, sampleY)
    .map((element) => element.closest<HTMLElement>('[data-nav-section]'))
    .find((element): element is HTMLElement => Boolean(element));
}

export function ImmersiveNavbar({ pageKind = 'home', currentPath = '/' }: Props) {
  const links = pageKind === 'home' ? homeLinks : propertyLinks;
  const [hidden, setHidden] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const [theme, setTheme] = useState<NavTheme>('photo');
  const [menuOpen, setMenuOpen] = useState(false);
  const previousScroll = useRef(0);
  const reducedMotion = useReducedMotion();
  const { scrollY } = useScroll();

  const syncVisibleSection = () => {
    const section = sectionAtViewport();
    if (!section) return;
    setActiveSection(section.dataset.navSection ?? section.id);
    const nextTheme = section.dataset.navTheme;
    setTheme(nextTheme === 'dark' || nextTheme === 'light' ? nextTheme : 'photo');
  };

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = previousScroll.current;
    previousScroll.current = latest;
    syncVisibleSection();

    if (latest < 120) {
      setHidden(false);
      return;
    }
    if (Math.abs(latest - previous) < 8) return;
    setHidden(latest > previous);
  });

  useEffect(() => {
    syncVisibleSection();
  }, []);

  const isActive = (link: (typeof links)[number]) => {
    if (link.route) return currentPath === link.route;
    return activeSection === link.section;
  };

  return (
    <motion.header
      className={`immersive-nav immersive-nav--${theme}`}
      animate={{
        transform: hidden && !menuOpen && !reducedMotion ? 'translateY(-100%)' : 'translateY(0%)',
      }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="immersive-nav__inner">
        <a href="/" className="immersive-nav__brand" aria-label="La Arbolada, inicio">
          La Arbolada
        </a>

        <nav className="immersive-nav__links" aria-label="Navegación principal">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={isActive(link) ? 'is-active' : ''}
              aria-current={isActive(link) ? (link.route ? 'page' : 'location') : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="immersive-nav__menu-button" aria-label="Abrir menú">
              <Menu size={22} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="mobile-menu__overlay" />
            <Dialog.Content className="mobile-menu__content" aria-describedby={undefined}>
              <div className="mobile-menu__top">
                <Dialog.Title className="mobile-menu__title">La Arbolada</Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="mobile-menu__close" aria-label="Cerrar menú">
                    <X size={24} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <nav className="mobile-menu__nav" aria-label="Navegación móvil">
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={isActive(link) ? 'is-active' : ''}
                    aria-current={isActive(link) ? (link.route ? 'page' : 'location') : undefined}
                  >
                    <span>{link.label}</span>
                  </a>
                ))}
              </nav>
              <p className="mobile-menu__footer">Alquiler temporal en Tandil</p>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </motion.header>
  );
}
