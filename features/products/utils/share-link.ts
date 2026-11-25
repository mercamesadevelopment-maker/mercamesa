/**
 * Links para compartir un producto o una tienda.
 *
 * Un producto tiene su página, `/products/<id>` (el id de `store_products`). Antes
 * no la tenía y el link apuntaba a su tienda con `?product=<id>`, que
 * `app/stores/[slug]/page.tsx` todavía entiende para los links que ya se mandaron.
 */

export function getStoreShareUrl(storeSlug: string): string {
  return `${window.location.origin}/stores/${storeSlug}`;
}

/** La ruta de la página del producto, para un `<Link>`. */
export function getProductPath(productId: string): string {
  return `/products/${productId}`;
}

/**
 * El enlace completo. La página del producto se pinta primero en el servidor,
 * donde no hay `window`: ahí sale la ruta sola, y en el navegador el enlace entero
 * (compartir solo se usa en el navegador).
 */
export function getProductShareUrl(productId: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${getProductPath(productId)}`;
}
