'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/src/components/Shared';

interface QuantityStepperProps {
  qty: number;
  onChange: (qty: number) => void;
  /** Tope superior, normalmente el stock disponible. */
  max?: number;
  /** Debajo de este valor el `-` avisa hacia afuera en vez de bajar. */
  min?: number;
  /**
   * Se llama cuando el `-` bajaría de `min`. Sirve para pedir confirmación antes
   * de sacar el producto del carrito, en vez de quitarlo de una.
   */
  onBelowMin?: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** Para que quien lo usa decida cuánto ocupa (p. ej. todo el ancho en una tarjeta angosta). */
  className?: string;
}

/**
 * Control de cantidad `- n +`.
 *
 * Vivía duplicado en el panel del carrito y hacía falta también en la tarjeta de
 * producto; existe una sola vez para que las dos vistas se comporten igual.
 *
 * No guarda estado: la cantidad siempre viene de afuera (del carrito), así que
 * los dos lugares donde se muestra no se pueden desincronizar.
 */
export function QuantityStepper({
  qty,
  onChange,
  max,
  min = 1,
  onBelowMin,
  size = 'md',
  disabled = false,
  className,
}: QuantityStepperProps) {
  const atMax = max !== undefined && qty >= max;

  const handleDecrement = () => {
    if (qty <= min) {
      onBelowMin?.();
      return;
    }
    onChange(qty - 1);
  };

  const btn = cn(
    // `shrink-0`: sin él, en un contenedor angosto los botones se aplastan.
    'flex shrink-0 items-center justify-center rounded-full text-mm-txs transition-colors',
    'hover:text-mm-g hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
    size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'
  );

  return (
    <div
      className={cn(
        'flex items-center bg-mm-gbg rounded-full shrink-0',
        size === 'sm' ? 'gap-2 px-2 py-1' : 'gap-1.5 px-1.5 py-1',
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled}
        aria-label="Quitar uno"
        className={btn}
      >
        <Minus className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </button>

      <span
        className={cn(
          'shrink-0 font-bold text-center tabular-nums text-mm-g',
          size === 'sm' ? 'text-xs w-4' : 'text-sm w-6'
        )}
      >
        {qty}
      </span>

      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        disabled={disabled || atMax}
        aria-label="Agregar uno"
        title={atMax ? 'No hay más unidades disponibles' : undefined}
        className={btn}
      >
        <Plus className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </button>
    </div>
  );
}
