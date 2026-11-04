import type { OrderPricing } from '@/lib/pricing/compute-order-pricing';

export type CheckoutQuote = OrderPricing;

export interface QuoteRequest {
  delivery_address_id: string;
  /** Toda la canasta: el servidor reparte los productos entre sus tiendas. */
  items: { store_product_id: string; quantity: number }[];
}

/**
 * Pide al servidor el desglose del precio de la canasta.
 *
 * El navegador ya no calcula precios: manda qué productos y cuántos, y recibe lo
 * que se va a cobrar. Así lo que el comprador ve antes de pagar es exactamente lo
 * que `POST /api/orders` va a guardar.
 */
export async function quoteCheckout(payload: QuoteRequest): Promise<CheckoutQuote> {
  const res = await fetch('/api/checkout/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  if (!res.ok) {
    // El mensaje del 503 es el texto que el comprador debe leer tal cual.
    throw new Error(result.error || 'No pudimos calcular el total de tu pedido.');
  }

  return result.data as CheckoutQuote;
}
