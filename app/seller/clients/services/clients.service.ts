import type { ClientWithMetrics } from '@/lib/stores/store-clients';

/** Los clientes de una tienda, o de todas las que ve quien pregunta (`'all'`). */
export async function fetchStoreClientsService(scope: string): Promise<ClientWithMetrics[]> {
  const response = await fetch(`/api/seller/clients/history?store_id=${encodeURIComponent(scope)}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'No se pudieron cargar los clientes.');
  return (result.data as ClientWithMetrics[]) ?? [];
}
