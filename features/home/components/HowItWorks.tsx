import type { RefObject } from 'react';
import { HOME_ANCHORS, HOME_HOW_VIDEO } from '../content';

/**
 * «Así funciona MercaMesa»: la animación del proceso. Arranca sola y sin sonido,
 * en bucle; con «reducir movimiento» queda quieta en el póster (lo decide
 * `useHomeVideo`).
 */
export function HowItWorks({ videoRef, autoPlay }: { videoRef: RefObject<HTMLVideoElement | null>; autoPlay: boolean }) {
  return (
    <section id={HOME_ANCHORS.asi} aria-labelledby="asi-t" className="mt-12 scroll-mt-6 px-1 md:mt-24 md:px-0">
      <div className="mb-4 md:mb-6 md:flex md:flex-wrap md:items-end md:justify-between md:gap-x-8 md:gap-y-3">
        <h2
          id="asi-t"
          className="m-0 mb-[10px] text-[26px] font-bold leading-[1.1] tracking-[-0.03em] md:mb-0 md:text-[clamp(30px,3vw,42px)] md:leading-[1.08]"
        >
          Así funciona MercaMesa
        </h2>
        <p className="m-0 text-sm leading-[1.5] text-tinta-texto md:hidden">
          Le escribes a Carolina, ella elige la plaza, arma tu mercado y te lo enviamos.
        </p>
        <p className="m-0 hidden max-w-[520px] text-base leading-[1.55] text-tinta-texto md:block">
          Le escribes a Carolina, ella elige la plaza, arma tu mercado con los mejores precios y te lo enviamos a la casa.
        </p>
      </div>
      <video
        ref={videoRef}
        src={HOME_HOW_VIDEO.src}
        poster={HOME_HOW_VIDEO.poster}
        autoPlay={autoPlay}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Animación: tú le escribes a Carolina, ella elige la Plaza Minorista, arma tu mercado, te muestra el ahorro y el domiciliario lo lleva a tu casa"
        className="block aspect-[1892/1042] h-auto w-full"
      />
    </section>
  );
}
