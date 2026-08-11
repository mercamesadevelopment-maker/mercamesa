import { piboxFetch } from '../client';
import type {
  PiboxBookingEnvelope,
  PiboxBookingResponse,
  PiboxEtaResponse,
} from '../types';

/** POST /bookings/eta — cotiza el costo sin crear el servicio ni despachar conductor. */
export async function estimateBooking(payload: PiboxBookingEnvelope): Promise<PiboxEtaResponse> {
  return piboxFetch<PiboxEtaResponse>('/bookings/eta', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** POST /bookings — crea el pedido real. Despacha un mensajero. */
export async function createBooking(payload: PiboxBookingEnvelope): Promise<PiboxBookingResponse> {
  return piboxFetch<PiboxBookingResponse>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** GET /bookings/{id} */
export async function getBooking(bookingId: string): Promise<PiboxBookingResponse> {
  return piboxFetch<PiboxBookingResponse>(`/bookings/${bookingId}`);
}

/** PATCH /bookings/{id}/cancel */
export async function cancelBooking(bookingId: string): Promise<PiboxBookingResponse> {
  return piboxFetch<PiboxBookingResponse>(`/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
  });
}

/** GET /bookings/cost_centers */
export async function listCostCenters(): Promise<{ _id: string; name: string }[]> {
  return piboxFetch<{ _id: string; name: string }[]>('/bookings/cost_centers');
}

/**
 * Extrae el primer paquete de la respuesta de un booking. Mercamesa crea un
 * booking con una sola parada y un solo paquete por store_order, así que
 * este acceso es determinista.
 */
export function extractFirstPackage(booking: PiboxBookingResponse) {
  return booking.stops?.[0]?.packages?.[0] ?? null;
}
