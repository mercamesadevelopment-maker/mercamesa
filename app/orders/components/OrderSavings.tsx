import { Tag } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { ORDER_SAVINGS_LABEL } from '@/lib/copy/discount-notice';

interface OrderSavingsProps {
  /** Lo ahorrado en los productos del pedido. Con 0 no se pinta nada. */
  amount: number;
  className?: string;
}

/**
 * Cuánto se ahorró el comprador en un pedido que traía productos en oferta.
 *
 * Va en verde, igual que el resumen de descuentos del carrito: es la misma
 * noticia, dicha después de comprar.
 */
export function OrderSavings({ amount, className }: OrderSavingsProps) {
  if (!(amount > 0)) return null;

  return (
    <p className={cn('flex items-center gap-1.5 text-xs font-bold text-ok', className)}>
      <Tag className="h-3.5 w-3.5 shrink-0" />
      {ORDER_SAVINGS_LABEL(fmt(amount))}
    </p>
  );
}
