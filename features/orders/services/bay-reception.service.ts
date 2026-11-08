import type { BayReception } from '@/lib/logistics/bay-reception';

/**
 * Cómo recibió logística la parte de una tienda en la bahía. `null` si no pasó
 * por logística o si quien pregunta no puede verla (403).
 */
export async function fetchBayReceptionService(storeOrderId: string): Promise<BayReception | null> {
  const response = await fetch(`/api/store-orders/${encodeURIComponent(storeOrderId)}/bay-reception`);
  if (response.status === 403) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'No se pudo consultar la recepción en la bahía.');
  return (result.data as BayReception | null) ?? null;
}
