'use client';

import { useCallback, useRef } from 'react';
import { useMediaQuery } from '@/features/layout/hooks/use-media-query';
import { HOME_ANCHORS } from '../content';

/**
 * El video de la página de inicio.
 *
 * Mientras no exista «La historia de la plaza», el botón de reproducir y «Mira
 * el video» llevan a la animación de «Así funciona» y la reinician. Cuando llegue
 * el video, se cambia `play` y nada más.
 *
 * Con «reducir movimiento» la animación no arranca sola: queda el póster, y solo
 * se reproduce si la persona la pide.
 */
export function useHomeVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const scrollTo = useCallback(
    (anchor: string) => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    },
    [reducedMotion]
  );

  const play = useCallback(() => {
    scrollTo(HOME_ANCHORS.asi);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {
      // El navegador puede negarse; queda el póster y los controles del sistema.
    });
  }, [scrollTo]);

  return { videoRef, autoPlay: !reducedMotion, play, scrollTo };
}
