import type { LogisticsOrder } from '@/lib/logistics/orders';

export type LogisticsScope = 'open' | 'closed';

async function leer(res: Response): Promise<any> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos completar la operación.');
  return json;
}

export const logisticsService = {
  async list(scope: LogisticsScope): Promise<LogisticsOrder[]> {
    const json = await leer(await fetch(`/api/logistics/orders?scope=${scope}`));
    return json.data as LogisticsOrder[];
  },

  /** Logística recibió en la bahía la parte de una tienda. */
  async receive(storeOrderId: string): Promise<{ order: LogisticsOrder; deliveryError: string | null }> {
    const json = await leer(await fetch(`/api/logistics/store-orders/${storeOrderId}/receive`, { method: 'POST' }));
    return { order: json.data as LogisticsOrder, deliveryError: json.deliveryError ?? null };
  },

  /** Le entregó el pedido al domiciliario: «En camino». */
  async dispatch(orderId: string): Promise<LogisticsOrder> {
    const json = await leer(await fetch(`/api/logistics/orders/${orderId}/dispatch`, { method: 'POST' }));
    return json.data as LogisticsOrder;
  },
};
