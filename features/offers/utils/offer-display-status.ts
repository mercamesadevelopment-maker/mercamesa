import type { StoreOffer } from '../types/offer.types';

/**
 * El estado de una oferta tal como lo vive el comprador.
 *
 * `status` dice si la oferta fue aprobada, no si está corriendo: una oferta
 * `active` cuya fecha de fin ya pasó sigue en `active` en la base, aunque el
 * comprador ya no la vea ni se le cobre (`resolveOfferPrices` filtra por fechas).
 * Sin esto el tendero la veía "Activa" sin saber que ya no aplica.
 */
export type OfferDisplayStatus = StoreOffer['status'] | 'expired' | 'scheduled';

export function offerDisplayStatus(
  offer: Pick<StoreOffer, 'status' | 'starts_at' | 'ends_at'>,
  now: Date = new Date()
): OfferDisplayStatus {
  if (offer.status !== 'active') return offer.status;
  // Mismo criterio que `resolveOfferPrices`: vigente mientras `ends_at >= ahora`.
  if (offer.ends_at && new Date(offer.ends_at) < now) return 'expired';
  if (offer.starts_at && new Date(offer.starts_at) > now) return 'scheduled';
  return 'active';
}
