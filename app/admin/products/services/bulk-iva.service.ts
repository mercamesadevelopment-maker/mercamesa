/** Cambia la tarifa de IVA de varios productos del catálogo (`PATCH /api/products/bulk-iva`). */
export async function applyBulkIva(productIds: string[], ivaRate: number): Promise<number> {
  const res = await fetch('/api/products/bulk-iva', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_ids: productIds, iva_rate: ivaRate }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'No se pudo cambiar el IVA');
  return Number(json.updated ?? 0);
}
