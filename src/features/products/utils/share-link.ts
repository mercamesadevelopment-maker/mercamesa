/**
 * Links para compartir un producto o una tienda.
 *
 * No hay página de producto individual: `ProductCard` solo existe dentro del
 * catálogo de una tienda o del listado de todo el marketplace, siempre paginado.
 * Por eso el link de un producto apunta a su tienda con `?product=<id>`, que
 * `app/stores/[slug]/page.tsx` usa para saltar a la página donde está y
 * resaltarlo, en vez de a una ruta que no existe.
 */

export function getStoreShareUrl(storeSlug: string): string {
  return `${window.location.origin}/stores/${storeSlug}`;
}

export function getProductShareUrl(storeSlug: string, productId: string): string {
  return `${window.location.origin}/stores/${storeSlug}?product=${productId}`;
}
