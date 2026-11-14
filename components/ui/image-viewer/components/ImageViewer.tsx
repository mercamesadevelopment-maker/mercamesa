'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useImageZoom } from '../hooks/useImageZoom';
import type { ImageViewerProps } from '../types';

/** Lo que dura la salida; con «reducir movimiento» la transición no se ve. */
const EXIT_MS = 180;

/**
 * Una foto en grande sobre toda la pantalla, con zoom al tocarla (ver
 * `useImageZoom`). Se cierra con la X, tocando el fondo o con Escape.
 *
 * Va en la capa de `Modal` (z-[250]): por encima del carrito.
 */
export function ImageViewer({ isOpen, onClose, src, placeholderSrc, alt, caption }: ImageViewerProps) {
  const { zoomed, reset, imageStyle, handlers } = useImageZoom();
  // Primero la pequeña, que ya está en caché; el original (puede pesar varios
  // MB) la reemplaza cuando termina de bajar.
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || src);
  // `shown` dispara la entrada un cuadro después de montar, y la salida antes
  // de avisar `onClose`: solo opacity y transform, en CSS.
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!placeholderSrc) {
      setCurrentSrc(src);
      return;
    }
    setCurrentSrc(placeholderSrc);
    const full = new Image();
    full.onload = () => setCurrentSrc(src);
    full.src = src;
    return () => {
      full.onload = null;
    };
  }, [src, placeholderSrc]);

  const close = () => {
    setShown(false);
    window.setTimeout(() => {
      reset();
      onClose();
    }, EXIT_MS);
  };

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
    // `close` cambia en cada render; el efecto solo depende de abrir o cerrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={close}
      className={cn(
        'fixed inset-0 z-[250] flex flex-col items-center justify-center gap-3 bg-tinta/95 p-4 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none sm:p-8',
        shown ? 'opacity-100' : 'opacity-0'
      )}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Cerrar"
        onClick={close}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-hueso transition-colors hover:bg-white/25"
      >
        <X className="h-5 w-5" />
      </button>

      {/* La foto: tocarla no cierra, acerca. El recuadro recorta la foto
          acercada para que no tape la X ni el texto. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'overflow-hidden rounded-2xl bg-hueso transition-transform duration-200 motion-reduce:transition-none',
          shown ? 'scale-100' : 'scale-95'
        )}
      >
        <img
          src={currentSrc}
          alt={alt}
          draggable={false}
          onError={() => {
            if (placeholderSrc && currentSrc !== placeholderSrc) setCurrentSrc(placeholderSrc);
          }}
          {...handlers}
          style={imageStyle}
          className={cn(
            'block max-h-[78vh] w-auto max-w-[min(92vw,1100px)] select-none object-contain transition-transform duration-150 ease-out motion-reduce:transition-none',
            zoomed ? 'cursor-zoom-out touch-none' : 'cursor-zoom-in'
          )}
        />
      </div>

      {caption && <p className="max-w-[92vw] text-center text-sm font-semibold text-hueso">{caption}</p>}
      <p className="font-mono text-[10px] uppercase tracking-widest text-hueso/70">
        {zoomed ? 'Toca de nuevo para alejar' : 'Toca la foto para acercar'}
      </p>
    </div>,
    document.body
  );
}
