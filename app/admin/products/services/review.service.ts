/**
 * Revisión de los productos que proponen los tenderos desde la carga masiva.
 * Ver `app/api/products/[id]/review/route.ts`.
 */

async function revisar(id: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`/api/products/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo revisar el producto.');
}

/** Lo pasa al catálogo de todas las tiendas que lo pueden ver. */
export function approveProductService(id: string): Promise<void> {
  return revisar(id, { action: 'approve' });
}

/** Ya existía: las tiendas que lo vendían pasan a vender `targetId` y el propuesto se borra. */
export function mergeProductService(id: string, targetId: string): Promise<void> {
  return revisar(id, { action: 'merge', target_id: targetId });
}

/** Cuántos productos esperan revisión. */
export async function fetchPendingReviewCountService(): Promise<number> {
  const response = await fetch('/api/products?page=1&pageSize=1&review=pending');
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudieron contar los pendientes.');
  return Number(result.count ?? 0);
}

/** Productos aprobados que coinciden con la búsqueda, para elegir con cuál unir. */
export async function searchApprovedProductsService(
  search: string
): Promise<{ id: string; name: string; category: string | null }[]> {
  const params = new URLSearchParams({ page: '1', pageSize: '20', review: 'approved' });
  if (search) params.set('search', search);
  const response = await fetch(`/api/products?${params}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo buscar en el catálogo.');
  return (result.data ?? []).map((p: { id: string; name: string; categories?: { name: string } | null }) => ({
    id: p.id,
    name: p.name,
    category: p.categories?.name ?? null,
  }));
}
