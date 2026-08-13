'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/components/Shared';

interface CategoryScrollerProps {
  categories: string[];
  activeCategory: string;
  onSelect: (category: string) => void;
}

const SCROLL_STEP = 240;

/**
 * Tira horizontal de categorías.
 *
 * Antes las flechas estaban en `opacity-0 group-hover:opacity-100`: en táctil no
 * aparecían nunca (no hay hover) y en escritorio, al estar solo transparentes,
 * seguían capturando los clics de la primera y la última categoría. Con muchas
 * categorías la tira simplemente no se podía recorrer.
 *
 * Acá las flechas se muestran solo cuando de verdad hay desbordamiento, se
 * ocultan al llegar a cada extremo y llevan `pointer-events-none` cuando no
 * aplican. Además la rueda vertical del mouse desplaza en horizontal, que es lo
 * que la gente intenta por instinto.
 */
export function CategoryScroller({ categories, activeCategory, onSelect }: CategoryScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 1px de margen: los navegadores redondean scrollLeft y sin tolerancia la
    // flecha derecha se queda encendida al final del recorrido.
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateArrows();

    // Al cambiar el ancho del contenedor o la cantidad de categorías, lo que
    // desborda cambia: sin observarlo, las flechas se quedan desactualizadas.
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);

    return () => observer.disconnect();
  }, [categories, updateArrows]);

  const scrollBy = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;

    // Solo se intercepta el gesto vertical puro; si el trackpad ya manda
    // desplazamiento horizontal, se deja pasar tal cual.
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    el.scrollLeft += e.deltaY;
  };

  const arrowClass =
    'absolute z-10 p-2 bg-white rounded-full shadow-md border border-mm-crd text-mm-txs hover:text-mm-g transition-opacity';

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label="Ver categorías anteriores"
        onClick={() => scrollBy(-SCROLL_STEP)}
        className={cn(
          arrowClass,
          'left-0 -ml-1',
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div
        ref={scrollRef}
        onScroll={updateArrows}
        onWheel={handleWheel}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-grow px-2"
      >
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            className={cn(
              'px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap',
              activeCategory === category
                ? 'bg-mm-g text-white shadow-md'
                : 'bg-white border border-mm-crd text-mm-txs hover:border-mm-g'
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label="Ver más categorías"
        onClick={() => scrollBy(SCROLL_STEP)}
        className={cn(
          arrowClass,
          'right-0 -mr-1',
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
