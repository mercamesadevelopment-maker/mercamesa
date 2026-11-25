'use client';

import React, { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useImageZoom } from '@/components/ui/image-viewer/hooks/useImageZoom';
import { ImageViewer } from '@/components/ui/image-viewer/components/ImageViewer';

interface ProductGalleryProps {
  /** La foto original, para que el zoom se vea nítido. */
  src: string | null;
  /** La de la tarjeta, que ya está en caché: se ve mientras baja la original. */
  placeholderSrc: string | null;
  alt: string;
}

/**
 * La foto del producto con zoom, como en Mercado Libre (`useImageZoom`):
 *
 * - con el mouse, un clic acerca y la foto sigue al cursor; al salir se aleja;
 * - con el dedo, un toque acerca y se arrastra; otro toque aleja;
 * - el botón de la esquina la abre a pantalla completa.
 */
export function ProductGallery({ src, placeholderSrc, alt }: ProductGalleryProps) {
  const { zoomed, reset, imageStyle, handlers } = useImageZoom();
  const [fullscreen, setFullscreen] = useState(false);
  const [current, setCurrent] = useState(src || placeholderSrc);

  if (!current) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-[28px] bg-hueso text-7xl" aria-hidden>
        📦
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="aspect-square overflow-hidden rounded-[28px] bg-hueso" onPointerLeave={(e) => e.pointerType === 'mouse' && reset()}>
        <img
          src={current}
          alt={alt}
          draggable={false}
          width={600}
          height={600}
          // Si el original no carga, queda la de la tarjeta.
          onError={() => placeholderSrc && current !== placeholderSrc && setCurrent(placeholderSrc)}
          {...handlers}
          style={imageStyle}
          className={cn(
            'h-full w-full select-none object-contain transition-transform duration-150 ease-out motion-reduce:transition-none',
            zoomed ? 'cursor-zoom-out touch-none' : 'cursor-zoom-in'
          )}
        />
      </div>
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        aria-label="Ver la foto a pantalla completa"
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-tinta shadow-sm hover:bg-white"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-mm-txw">
        {zoomed ? 'Toca de nuevo para alejar' : 'Toca la foto para acercar'}
      </p>
      {fullscreen && (
        <ImageViewer isOpen onClose={() => setFullscreen(false)} src={src || current} placeholderSrc={placeholderSrc} alt={alt} caption={alt} />
      )}
    </div>
  );
}
