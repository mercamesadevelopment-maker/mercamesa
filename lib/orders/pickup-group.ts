/**
 * Qué tiendas pueden ir en un mismo pedido.
 *
 * La regla es física: un pedido sale en un solo domicilio, así que solo se
 * pueden juntar tiendas que comparten punto de recogida. Eso es `pickup_group`,
 * una columna generada de `stores`: las tiendas de una plaza que despachan desde
 * ella comparten valor; una tienda con dirección propia tiene el suyo.
 *
 * Función pura, sin red ni base: la usan el carrito (para avisar al agregar) y
 * el servidor (que es el que decide).
 */

/** Lo que lee el comprador cuando intenta juntar tiendas que no despachan juntas. */
export const MIXED_PICKUP_MESSAGE =
  'Solo puedes juntar en un pedido tiendas de la misma plaza. Termina este pedido o vacía la canasta para comprar en la otra.';

/**
 * Si todos comparten punto de recogida. Un grupo desconocido (`null`) nunca
 * coincide con nada: ante la duda no se mezcla.
 */
export function sharePickupPoint(groups: (string | null | undefined)[]): boolean {
  if (groups.length === 0) return true;
  const [primero, ...resto] = groups;
  if (!primero) return false;
  return resto.every((g) => g === primero);
}
