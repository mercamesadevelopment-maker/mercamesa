/**
 * Cambia la categoría de un producto del catálogo maestro. Es del producto, no
 * de la tienda: aplica a todas las tiendas que lo venden. Exige el permiso
 * `master-catalog` / `update` (lo comprueba la ruta).
 */
export async function updateCatalogCategory(catalogProductId: string, categoryId: string): Promise<void> {
  const res = await fetch(`/api/products/${catalogProductId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryId }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'No se pudo cambiar la categoría del producto.');
  }
}
