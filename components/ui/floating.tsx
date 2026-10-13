'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/src/components/Shared';

/**
 * Un producto que flota en bucle, con su sombra en el piso.
 *
 * Es la única forma de animar en bucle un producto: así la regla de
 * rendimiento vive en un solo lugar (ver «El producto flotando» en
 * `app/globals.css`).
 *
 * - Úsalo solo en elementos destacados (portada, promociones), no en cada
 *   tarjeta de un listado.
 * - Fuera de la pantalla la animación se pausa. Todas las instancias comparten
 *   un solo `IntersectionObserver`, en vez de uno por elemento.
 * - `delay` desfasa varios productos para que no suban y bajen al tiempo.
 */
interface FloatingProps {
  children: React.ReactNode;
  className?: string;
  /** Sombra elíptica bajo el producto. Apágala si el fondo ya tiene su propio piso. */
  shadow?: boolean;
  /** Segundos de desfase del ciclo. */
  delay?: number;
}

let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('mm-paused', !e.isIntersecting);
    });
  }
  return observer;
}

export function Floating({ children, className, shadow = true, delay = 0 }: FloatingProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const io = sharedObserver();
    if (!el || !io) return;
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  const style = delay ? ({ animationDelay: `-${delay}s` } as React.CSSProperties) : undefined;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div className="mm-float relative z-10" style={style}>
        {children}
      </div>
      {shadow && (
        <div
          aria-hidden
          className="mm-float-shadow mx-auto -mt-2 h-3 w-3/4 rounded-[50%] bg-black/40 blur-md"
          style={style}
        />
      )}
    </div>
  );
}
