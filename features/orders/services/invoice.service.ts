import type { OrderInvoiceLink } from '@/lib/siigo/invoice-link';

/**
 * La factura de Siigo de la parte de una tienda. Quien no puede verla (un
 * tendero) recibe 403: se toma como que no hay nada que mostrar.
 */
export async function fetchOrderInvoiceService(storeOrderId: string): Promise<OrderInvoiceLink | null> {
  const response = await fetch(`/api/orders/invoice?store_order_id=${encodeURIComponent(storeOrderId)}`);
  if (response.status === 403) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'No se pudo consultar la factura.');
  return (result.data as OrderInvoiceLink | null) ?? null;
}
