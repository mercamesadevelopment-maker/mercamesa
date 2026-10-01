import React from 'react';
import { ShoppingBasket } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { salesTypeLabel, type StoreSalesType } from '@/lib/stores/sales-type';

interface SalesTypeLineProps {
  store: StoreSalesType;
  className?: string;
}

/**
 * A quién le vende la tienda, como una línea de texto en las tarjetas.
 *
 * Como insignia junto a las categorías se confundía con ellas, y además con el
 * nombre de la plaza («Plaza Minorista» encima de «Mayorista y minorista»). Por
 * eso va aparte y dice «Venta …».
 */
export function SalesTypeLine({ store, className }: SalesTypeLineProps) {
  const label = salesTypeLabel(store);
  if (!label) return null;

  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-mm-txs', className)}>
      <ShoppingBasket className="w-3.5 h-3.5 shrink-0 text-mm-txw" />
      Venta {label.toLowerCase()}
    </p>
  );
}
