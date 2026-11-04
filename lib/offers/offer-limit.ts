/**
 * Los topes de un pedido: el máximo por pedido de una oferta y cuántas tiendas
 * puede juntar.
 *
 * El servidor los aplica al cotizar y al crear el pedido (`buildOrderDraft`); la
 * canasta y las tarjetas usan las mismas funciones para no dejar pasar del tope,
 * así el comprador no se entera recién al pagar.
 */

/** Cuántas tiendas de una plaza caben en un pedido. */
export const MAX_STORES_PER_ORDER = 9;

export function tooManyStoresMessage(count: number): string {
  return `Un pedido puede tener productos de hasta ${MAX_STORES_PER_ORDER} tiendas, y el tuyo tiene ${count}. Quita los de alguna tienda para continuar.`;
}

/** El mensaje cuando la canasta ya está en el tope y se intenta sumar otra tienda. */
export const STORE_LIMIT_REACHED_MESSAGE = `Tu canasta ya tiene productos de ${MAX_STORES_PER_ORDER} tiendas, el máximo para un pedido. Termina este pedido o quita los de alguna tienda para agregar de otra.`;

/**
 * Hasta dónde deja subir el contador: las existencias o, si es menor, el máximo
 * por pedido de la oferta.
 */
export function maxQtyFor(stock: number | null | undefined, offerMax: number | null | undefined): number {
  const disponibles = Number(stock ?? 0);
  return offerMax != null && offerMax > 0 ? Math.min(disponibles, Number(offerMax)) : disponibles;
}

/** «3 kg», sin decimales sobrantes. */
function cantidad(qty: number, unit: string | null | undefined): string {
  const n = Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(3)));
  return unit ? `${n} ${unit}` : n;
}

export function offerLimitLabel(max: number, unit: string | null | undefined): string {
  return `Máx. ${cantidad(max, unit)} por pedido`;
}

export interface OfferLimitLine {
  name: string;
  unit: string | null;
  requested: number;
  max: number;
}

/**
 * Las líneas que piden más de lo que deja su oferta. Solo cuenta si la oferta se
 * aplicó: sin oferta (o al mayorista, que no la recibe) no hay límite.
 */
export function offerLimitViolations(
  lines: { name: string; unit: string | null; quantity: number; offerId: string | null; maxQtyPerOrder: number | null }[]
): OfferLimitLine[] {
  return lines
    .filter((l) => l.offerId && l.maxQtyPerOrder != null && l.quantity > l.maxQtyPerOrder)
    .map((l) => ({ name: l.name, unit: l.unit, requested: l.quantity, max: Number(l.maxQtyPerOrder) }));
}

export function offerLimitMessage(lines: OfferLimitLine[]): string {
  const detalle = lines.map((l) => `${l.name} (máximo ${cantidad(l.max, l.unit)})`).join(', ');
  return `Superas el máximo por pedido de la oferta en: ${detalle}. Ajusta las cantidades e intenta de nuevo.`;
}
