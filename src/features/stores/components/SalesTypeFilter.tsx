'use client';

import React from 'react';
import { cn } from '@/src/components/Shared';
import { SALES_TYPE_OPTIONS, type SalesTypeFilter as SalesTypeFilterValue } from '@/lib/stores/sales-type';

interface SalesTypeFilterProps {
  value: SalesTypeFilterValue;
  onChange: (value: SalesTypeFilterValue) => void;
  className?: string;
}

/**
 * Filtro «Todas / Minorista / Mayorista» de los listados públicos de tiendas.
 *
 * Son tres opciones fijas, así que van a la vista como botones y no escondidas
 * en un desplegable.
 */
export function SalesTypeFilter({ value, onChange, className }: SalesTypeFilterProps) {
  return (
    <div
      role="group"
      aria-label="Tipo de venta"
      className={cn('inline-flex shrink-0 bg-white border border-mm-crd rounded-full p-1', className)}
    >
      {SALES_TYPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 px-4 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap',
            value === option.value ? 'bg-mm-g text-white shadow-sm' : 'text-mm-txs hover:text-mm-g'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
