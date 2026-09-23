import type { SupabaseClient } from '@supabase/supabase-js';
import { offerFinalPrice } from './validate-offer';

/**
 * El precio real de unos productos, con la oferta vigente ya aplicada.
 *
 * Hasta ahora las ofertas vivían solo en el navegador: `fetchCart` las resolvía
 * al armar el carrito y sobrescribía `retailPrice`, mientras que el servidor
 * —`/api/checkout/quote` y `/api/orders`— cobraba el precio de lista sin
 * enterarse. El comprador veía un descuento que nunca se le hacía.
 *
 * Esto es la otra mitad: la misma regla, del lado que decide cuánto se cobra.
 * Que exista una sola función para las dos rutas es justamente para que no
 * vuelvan a discrepar.
 */

export interface PrecioResuelto {
  /** El precio del inventario, sin tocar. */
  listPrice: number;
  /** Lo que se cobra: el de lista, o el de la oferta si hay una vigente. */
  finalPrice: number;
  offerId: string | null;
  label: string | null;
}

/** Filas de `store_products` con lo mínimo para calcular un precio. */
interface ProductoConPrecio {
  id: string;
  price_per_unit: number | null;
  wholesale_price?: number | null;
}

/**
 * Devuelve un mapa `store_product_id → precio`, listo para recorrer los ítems
 * del pedido.
 *
 * `isWholesale` deja la oferta fuera a propósito: el descuento se define contra
 * `price_per_unit` y el carrito nunca lo ha aplicado sobre el precio mayorista,
 * que ya es un precio rebajado por su cuenta. Cambiar eso sería una decisión de
 * negocio, no una corrección.
 */
export async function resolveOfferPrices(
  supabase: SupabaseClient<any>,
  productos: ProductoConPrecio[],
  isWholesale: boolean
): Promise<Map<string, PrecioResuelto>> {
  const resultado = new Map<string, PrecioResuelto>();

  for (const p of productos) {
    const listPrice = isWholesale
      ? Number(p.wholesale_price || p.price_per_unit || 0)
      : Number(p.price_per_unit || 0);

    resultado.set(p.id, { listPrice, finalPrice: listPrice, offerId: null, label: null });
  }

  if (isWholesale || productos.length === 0) return resultado;

  const ahora = new Date().toISOString();

  // La vigencia se filtra en la base y no en memoria: son las mismas tres
  // condiciones que aplica el carrito, y así no viajan ofertas que no importan.
  const { data: ofertas, error } = await supabase
    .from('store_offers')
    .select('id, store_product_id, discount_pct, special_price, label, starts_at, ends_at, status')
    .in('store_product_id', productos.map((p) => p.id))
    .eq('status', 'active')
    .lte('starts_at', ahora)
    .or(`ends_at.is.null,ends_at.gte.${ahora}`);

  if (error) throw error;

  for (const oferta of ofertas ?? []) {
    const base = resultado.get(oferta.store_product_id);
    if (!base) continue;

    // Si un producto tuviera dos ofertas vigentes a la vez, gana la que más
    // descuenta. No debería pasar —`findOverlappingOffer` lo impide al crearlas—
    // pero elegir la primera que llegue dejaría el precio a merced del orden de
    // la consulta.
    const precio = offerFinalPrice(
      base.listPrice,
      oferta.discount_pct === null ? null : Number(oferta.discount_pct),
      oferta.special_price === null ? null : Number(oferta.special_price)
    );

    if (precio < base.finalPrice) {
      resultado.set(oferta.store_product_id, {
        listPrice: base.listPrice,
        finalPrice: precio,
        offerId: oferta.id,
        label: oferta.label ?? null,
      });
    }
  }

  return resultado;
}
