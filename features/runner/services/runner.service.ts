import type { RunnerOrder } from '@/lib/runner/orders';

export type RunnerScope = 'open' | 'closed';

export interface BayResult {
  order: RunnerOrder;
  /** Por qué no se pudo pedir el mensajero, si falló. */
  deliveryError: string | null;
}

async function leer(res: Response): Promise<any> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos completar la operación.');
  return json;
}

export const runnerService = {
  async list(scope: RunnerScope): Promise<RunnerOrder[]> {
    const json = await leer(await fetch(`/api/runner/orders?scope=${scope}`));
    return json.data as RunnerOrder[];
  },

  /** El patinador recogió la parte de una tienda. */
  async collect(storeOrderId: string): Promise<RunnerOrder> {
    const json = await leer(await fetch(`/api/runner/store-orders/${storeOrderId}/collect`, { method: 'POST' }));
    return json.data as RunnerOrder;
  },

  /** El pedido quedó completo en la bahía: pide el mensajero. */
  async markAtBay(orderId: string): Promise<BayResult> {
    const json = await leer(await fetch(`/api/runner/orders/${orderId}/bay`, { method: 'POST' }));
    return { order: json.data as RunnerOrder, deliveryError: json.deliveryError ?? null };
  },
};
