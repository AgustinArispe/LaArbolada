import { useEffect, useRef, type CSSProperties } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDownRight } from 'lucide-react';
import type { HeroFrame } from '@/data/journeys';

type Props = {
  frames: HeroFrame[];
};

function focalStyle(frame: HeroFrame): CSSProperties {
  return {
    '--focal-desktop': frame.desktopPosition,
    '--focal-mobile': frame.mobilePosition,
  } as CSSProperties;
}

export function ImmersiveHero({ frames }: Props) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const frameElements = gsap.utils.toArray<HTMLElement>('[data-hero-frame]');
      const frameImages = gsap.utils.toArray<HTMLElement>('[data-hero-image]');
      const titleLines = gsap.utils.toArray<HTMLElement>('[data-hero-line]');
      const supportingCopy = gsap.utils.toArray<HTMLElement>('[data-hero-support]');
      const copy = sectionRef.current?.querySelector<HTMLElement>('[data-hero-copy]');
      const scrim = sectionRef.current?.querySelector<HTMLElement>('[data-hero-scrim]');
      const progress = sectionRef.current?.querySelector<HTMLElement>('[data-hero-progress]');

      gsap.set(frameElements.slice(1), { clipPath: 'inset(0 0 0 100%)' });
      gsap.fromTo(
        titleLines,
        { transform: 'translateY(112%)' },
        {
          transform: 'translateY(0%)',
          duration: 0.82,
          stagger: 0.08,
          ease: 'power4.out',
        },
      );
      gsap.fromTo(
        supportingCopy,
        { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' },
        {
          autoAlpha: 1,
          clipPath: 'inset(0 0% 0 0)',
          duration: 0.72,
          stagger: 0.07,
          delay: 0.24,
          ease: 'power3.out',
        },
      );

      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: window.innerWidth < 768 ? 0.18 : 0.28,
          invalidateOnRefresh: true,
        },
      });

      if (progress) {
        timeline.fromTo(
          progress,
          { transform: 'scaleX(0)' },
          { transform: 'scaleX(1)', duration: 3.8 },
          0,
        );
      }

      if (scrim) {
        timeline.fromTo(scrim, { opacity: 0.72 }, { opacity: 1, duration: 3.8 }, 0);
      }

      if (copy) {
        timeline.to(copy, { autoAlpha: 0.52, transform: 'translateY(-1.25rem)', duration: 1 }, 2.5);
      }

      timeline
        .to(frameImages[0], { transform: 'scale(1.055)', duration: 1.1 }, 0)
        .to(frameElements[1], { clipPath: 'inset(0 0 0 0%)', duration: 0.65 }, 0.72)
        .to(frameImages[1], { transform: 'scale(1.05)', duration: 1.1 }, 0.72)
        .to(frameElements[2], { clipPath: 'inset(0 0 0 0%)', duration: 0.65 }, 1.63)
        .to(frameImages[2], { transform: 'scale(1.05)', duration: 1.1 }, 1.63)
        .to(frameElements[3], { clipPath: 'inset(0 0 0 0%)', duration: 0.7 }, 2.65)
        .to(frameImages[3], { transform: 'scale(1.045)', duration: 1.15 }, 2.65);
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      id="inicio"
      ref={sectionRef}
      className="immersive-hero"
      aria-labelledby="hero-title"
      data-nav-section="inicio"
      data-nav-theme="photo"
    >
      <div className="immersive-hero__stage">
        <div className="immersive-hero__frames" aria-hidden="true">
          {frames.map((frame, index) => {
            const { image } = frame;
            return (
              <figure
                key={image.id}
                className={`immersive-hero__frame immersive-hero__frame--${frame.mobileMode}`}
                data-hero-frame
                data-hero-image-id={frame.imageId}
                data-hero-mobile-mode={frame.mobileMode}
                style={focalStyle(frame)}
              >
                <picture className="immersive-hero__background" aria-hidden="true">
                  <source
                    media="(max-width: 767px)"
                    srcSet={`${image.sources.mobile} 900w, ${image.sources.desktop} 1600w`}
                    sizes="100vw"
                  />
                  <img
                    src={image.sources.large ?? image.sources.desktop}
                    srcSet={`${image.sources.desktop} 1600w${image.sources.large ? `, ${image.sources.large} 2400w` : ''}`}
                    sizes="100vw"
                    alt=""
                    loading={index < 2 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </picture>
                <picture className="immersive-hero__picture">
                  <source
                    media="(max-width: 767px)"
                    srcSet={`${image.sources.mobile} 900w, ${image.sources.desktop} 1600w`}
                    sizes="100vw"
                  />
                  <img
                    data-hero-image
                    src={image.sources.large ?? image.sources.desktop}
                    srcSet={`${image.sources.desktop} 1600w${image.sources.large ? `, ${image.sources.large} 2400w` : ''}`}
                    sizes="100vw"
                    alt=""
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </picture>
              </figure>
            );
          })}
        </div>
        <div className="immersive-hero__scrim" data-hero-scrim aria-hidden="true" />
        <div className="immersive-hero__copy" data-hero-copy>
          <h1 id="hero-title">
            <span className="immersive-hero__title-line">
              <span data-hero-line>Casa</span>
            </span>
            {' '}
            <span className="immersive-hero__title-line">
              <span data-hero-line>La Arbolada</span>
            </span>
          </h1>
          <div className="immersive-hero__support">
            <p data-hero-support>Una estadía entre piedra, árboles y agua.</p>
            <p data-hero-support>Alquiler temporal en Tandil.</p>
            <a href="#alojamientos" data-hero-support>
              Conocer los alojamientos
              <ArrowDownRight size={20} strokeWidth={1.6} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="immersive-hero__progress" aria-hidden="true">
          <span data-hero-progress />
        </div>
      </div>
    </section>
  );
}
