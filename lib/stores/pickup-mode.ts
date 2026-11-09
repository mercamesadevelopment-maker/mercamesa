/**
 * Desde dónde despacha una tienda: desde su plaza o desde su propia dirección.
 *
 * Sin dependencias: lo usan los formularios de la tienda (admin y tendero) en el
 * navegador. La validación de lo que se guarda vive en `pickup-address.ts`.
 *
 * Vacía —sin dirección ni punto en el mapa— la tienda despacha desde la bahía
 * de su plaza y se puede juntar en un pedido con las demás tiendas de la plaza
 * que también despachan desde ahí (`stores.pickup_group`).
 */

export interface PickupValues {
  address: string;
  city: string;
  department: string;
  latitude: string;
  longitude: string;
}

/** Lo que se manda para que la tienda vuelva a despachar desde su plaza. */
export const MARKETPLACE_PICKUP: Readonly<PickupValues> = Object.freeze({
  address: '',
  city: '',
  department: '',
  latitude: '',
  longitude: '',
});

/** Si la tienda tiene dirección propia, aunque esté a medias (solo el punto o solo el texto). */
export function hasOwnPickup(values: Pick<PickupValues, 'address' | 'latitude' | 'longitude'>): boolean {
  return Boolean(values.address.trim() || values.latitude || values.longitude);
}
