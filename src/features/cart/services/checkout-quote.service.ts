import type { OrderPricing } from '@/lib/pricing/compute-order-pricing';

export type CheckoutQuote = OrderPricing;

export interface QuoteRequest {
  store_id: string;
  delivery_address_id: string;
  items: { store_product_id: string; quantity: number }[];
}

/**
 * Pide al servidor el desglose del precio de un grupo del carrito.
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

/**
 * Suma las cotizaciones de varias tiendas. Un carrito con productos de dos
 * tiendas se despacha por separado, así que paga dos domicilios y dos veces los
 * cargos fijos.
 */
export function sumQuotes(quotes: CheckoutQuote[]): CheckoutQuote {
  return quotes.reduce(
    (acc, q) => ({
      productsSubtotal: acc.productsSubtotal + q.productsSubtotal,
      serviceCommission: acc.serviceCommission + q.serviceCommission,
      messagesAmount: acc.messagesAmount + q.messagesAmount,
      netPurchase: acc.netPurchase + q.netPurchase,
      platformCommission: acc.platformCommission + q.platformCommission,
      deliveryFee: acc.deliveryFee + q.deliveryFee,
      total: acc.total + q.total,
    }),
    {
      productsSubtotal: 0,
      serviceCommission: 0,
      messagesAmount: 0,
      netPurchase: 0,
      platformCommission: 0,
      deliveryFee: 0,
      total: 0,
    }
  );
}
