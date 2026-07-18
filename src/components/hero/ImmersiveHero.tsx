import { useEffect, useRef, type CSSProperties } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
      const copyElements = gsap.utils.toArray<HTMLElement>('[data-hero-copy]');
      const progress = sectionRef.current?.querySelector<HTMLElement>('[data-hero-progress]');

      gsap.set(frameElements.slice(1), { clipPath: 'inset(0 0 0 100%)' });
      gsap.set(copyElements.slice(1), { autoAlpha: 0, yPercent: 30 });

      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: window.innerWidth < 768 ? 0.55 : 0.9,
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

      timeline
        .to(frameImages[0], { transform: 'scale(1.055)', duration: 1.1 }, 0)
        .to(copyElements[0], { autoAlpha: 0, yPercent: -28, duration: 0.3 }, 0.52)
        .to(frameElements[1], { clipPath: 'inset(0 0 0 0%)', duration: 0.65 }, 0.72)
        .to(frameImages[1], { transform: 'scale(1.05)', duration: 1.1 }, 0.72)
        .to(copyElements[1], { autoAlpha: 1, yPercent: 0, duration: 0.3 }, 0.95)
        .to(copyElements[1], { autoAlpha: 0, yPercent: -26, duration: 0.28 }, 1.45)
        .to(frameElements[2], { clipPath: 'inset(0 0 0 0%)', duration: 0.65 }, 1.63)
        .to(frameImages[2], { transform: 'scale(1.05)', duration: 1.1 }, 1.63)
        .to(copyElements[2], { autoAlpha: 1, yPercent: 0, duration: 0.35 }, 1.88)
        .to(copyElements[2], { autoAlpha: 0, yPercent: -22, duration: 0.3 }, 2.48)
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
        <div className="immersive-hero__scrim" aria-hidden="true" />
        <div className="immersive-hero__copy">
          <h1 id="hero-title" data-hero-copy>
            Casa La Arbolada
          </h1>
          <p data-hero-copy>Alquiler temporal en Tandil.</p>
          <p data-hero-copy>Una casa y un departamento independiente rodeados de naturaleza.</p>
        </div>
        <div className="immersive-hero__progress" aria-hidden="true">
          <span data-hero-progress />
        </div>
      </div>
    </section>
  );
}
