/**
 * Reglas de una oferta, en un solo lugar.
 *
 * Hasta ahora no había ninguna: se podía crear una oferta escogiendo solo el
 * producto y dejando todo lo demás vacío, con lo que quedaba una "oferta" que no
 * descontaba nada. La API y el formulario comparten estas funciones para que la
 * regla no se escriba dos veces y se desincronice.
 *
 * La unidad de medida NO se valida acá porque la oferta no tiene unidad propia:
 * cuelga de un `store_product_id` y hereda la del inventario. Por eso el
 * formulario la muestra de solo lectura en vez de dejar escribirla.
 */

export interface OfferInput {
  discountPct: number | null;
  specialPrice: number | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Máximo de unidades por pedido a ese precio. `null`: sin límite. */
  maxQtyPerOrder?: number | null;
}

/** Precio del inventario contra el que se compara el precio especial. */
export interface OfferProductContext {
  pricePerUnit: number;
}

/**
 * El máximo por pedido tal como llega del formulario o de la API. Vacío es sin
 * límite; lo que no sea un número queda como `NaN` para que `validateOffer` lo
 * rechace en vez de tomarlo, en silencio, por «sin límite».
 */
export function parseMaxQty(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}

export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Devuelve el primer error encontrado, o `null` si la oferta es válida.
 * El orden importa: primero lo que impide calcular un precio, luego las fechas.
 */
export function validateOffer(
  input: OfferInput,
  product?: OfferProductContext | null
): string | null {
  const { discountPct, specialPrice, startsAt, endsAt } = input;

  const hasDiscount = discountPct !== null;
  const hasSpecial = specialPrice !== null;

  // Exactamente uno de los dos. Antes la nota del formulario decía que "si usas
  // ambos se priorizará el precio fijo", que es una ambigüedad, no una regla.
  if (!hasDiscount && !hasSpecial) {
    return 'Indica un porcentaje de descuento o un precio especial. Sin uno de los dos la oferta no descuenta nada.';
  }

  if (hasDiscount && hasSpecial) {
    return 'Usa el porcentaje de descuento o el precio especial, pero no ambos.';
  }

  if (hasDiscount && (discountPct! <= 0 || discountPct! >= 100)) {
    return 'El porcentaje de descuento debe estar entre 0 y 100.';
  }

  if (hasSpecial) {
    if (specialPrice! <= 0) {
      return 'El precio especial debe ser mayor que cero.';
    }
    if (product && specialPrice! >= product.pricePerUnit) {
      return `El precio especial debe ser menor que el precio del inventario (${formatCop(product.pricePerUnit)}). Así como está, no sería una oferta.`;
    }
  }

  const { maxQtyPerOrder } = input;
  if (maxQtyPerOrder !== undefined && maxQtyPerOrder !== null && !(Number.isFinite(maxQtyPerOrder) && maxQtyPerOrder > 0)) {
    return 'El máximo por pedido debe ser un número mayor que cero, o quedar vacío para no tener límite.';
  }

  if (!startsAt) {
    return 'La oferta necesita una fecha de inicio.';
  }

  if (endsAt) {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      return 'La fecha de fin debe ser posterior a la de inicio.';
    }
  }

  return null;
}

export function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Precio final que verá el comprador, con la misma prioridad que el carrito. */
export function offerFinalPrice(
  pricePerUnit: number,
  discountPct: number | null,
  specialPrice: number | null
): number {
  if (specialPrice !== null) return specialPrice;
  if (discountPct !== null) return Math.round(pricePerUnit * (1 - discountPct / 100));
  return pricePerUnit;
}
