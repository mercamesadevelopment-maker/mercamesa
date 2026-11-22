import type { BayReception } from '@/lib/logistics/bay-reception';
import type { StoreEvidence } from '@/lib/orders/store-evidence';

export interface PartEvidence {
  /** Cómo la recibió logística en la bahía. */
  reception: BayReception | null;
  /** Lo que dejó la tienda al marcar «Listo Recogida», cuando le tocaba a ella. */
  store: StoreEvidence | null;
}

const VACIA: PartEvidence = { reception: null, store: null };

/** La evidencia de la parte de una tienda. Vacía si quien pregunta no puede verla (403). */
export async function fetchBayReceptionService(storeOrderId: string): Promise<PartEvidence> {
  const response = await fetch(`/api/store-orders/${encodeURIComponent(storeOrderId)}/bay-reception`);
  if (response.status === 403) return VACIA;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'No se pudo consultar la recepción en la bahía.');
  return { reception: (result.data as BayReception | null) ?? null, store: (result.store as StoreEvidence | null) ?? null };
}
