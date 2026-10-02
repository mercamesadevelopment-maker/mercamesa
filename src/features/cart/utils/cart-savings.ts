import type { CartItem } from '@/src/types';

/**
 * Cuánto se ahorra el comprador con las ofertas de su canasta.
 *
 * Un solo cálculo para la tarjeta del producto, cada línea de la canasta, el pie
 * del paso 1 y el resumen del paso 2: si cada uno hiciera su resta, tarde o
 * temprano mostrarían cifras distintas del mismo descuento.
 */

/** El porcentaje de descuento, redondeado. 0 si el precio no bajó. */
export function discountPct(listPrice: number, price: number): number {
  if (!(listPrice > 0) || price >= listPrice) return 0;
  return Math.round((1 - price / listPrice) * 100);
}

export interface CartLineSavings {
  item: CartItem;
  /** Lo que se cobra por unidad, ya con la oferta. */
  price: number;
  /** El precio por unidad antes de la oferta. */
  listPrice: number;
  /** Lo ahorrado en la línea: la diferencia por la cantidad que lleva. */
  savings: number;
}

export interface CartSavings {
  /** Solo las líneas con descuento. */
  lines: CartLineSavings[];
  total: number;
}

export const NO_SAVINGS: CartSavings = { lines: [], total: 0 };

export function cartSavings(items: CartItem[], getPrice: (item: CartItem) => number): CartSavings {
  const lines = items
    .map((item) => {
      const price = getPrice(item);
      const listPrice = item.listPrice ?? 0;
      return { item, price, listPrice, savings: (listPrice - price) * item.qty };
    })
    .filter((l) => l.savings > 0);

  return { lines, total: lines.reduce((acc, l) => acc + l.savings, 0) };
}
