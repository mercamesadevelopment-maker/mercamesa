import { isPiboxDryRun, piboxFetch, PIBOX_SIMULATED_PREFIX } from '../client';
import { PIBOX_BOOKING_STATUS } from '../constants';
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
  if (isPiboxDryRun()) return simulatedBooking(newSimulatedId(), payload);

  return piboxFetch<PiboxBookingResponse>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** GET /bookings/{id} */
export async function getBooking(bookingId: string): Promise<PiboxBookingResponse> {
  if (isSimulated(bookingId)) return simulatedBooking(bookingId);

  return piboxFetch<PiboxBookingResponse>(`/bookings/${bookingId}`);
}

/** PATCH /bookings/{id}/cancel */
export async function cancelBooking(bookingId: string): Promise<PiboxBookingResponse> {
  if (isSimulated(bookingId)) {
    return { ...simulatedBooking(bookingId), status_cd: PIBOX_BOOKING_STATUS.CANCELED_BY_PASSENGER };
  }

  return piboxFetch<PiboxBookingResponse>(`/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
  });
}

/** GET /bookings/cost_centers */
export async function listCostCenters(): Promise<{ _id: string; name: string }[]> {
  return piboxFetch<{ _id: string; name: string }[]>('/bookings/cost_centers');
}

/*
 * Reservas simuladas (PIBOX_DRY_RUN). Se reconocen por el prefijo del id y no
 * por la variable: una reserva simulada que quedó guardada no debe consultarse
 * en Pibox aunque después se apague el simulacro.
 */

function newSimulatedId(): string {
  return `${PIBOX_SIMULATED_PREFIX}${crypto.randomUUID()}`;
}

function isSimulated(bookingId: string): boolean {
  return bookingId.startsWith(PIBOX_SIMULATED_PREFIX);
}

/**
 * Una reserva con la forma de las de Pibox, en «Buscando conductor». Sin
 * conductor ni enlace de seguimiento: no hay nadie en camino.
 */
function simulatedBooking(bookingId: string, payload?: PiboxBookingEnvelope): PiboxBookingResponse {
  const booking = payload?.booking;

  return {
    _id: bookingId,
    created_at: new Date().toISOString(),
    address: booking?.address ?? '',
    secondary_address: booking?.secondary_address ?? null,
    requested_service_type_id: booking?.requested_service_type_id ?? '',
    status_cd: PIBOX_BOOKING_STATUS.SEARCHING_DRIVER,
    estimated_cost: null,
    final_cost: null,
    driver: null,
    served_vehicle: null,
    stops: (booking?.stops ?? []).map((stop) => ({
      address: stop.address,
      secondary_address: stop.secondary_address ?? null,
      customer: stop.customer ?? null,
      finished: false,
      is_return_stop: false,
      packages: stop.packages.map((pkg, index) => ({
        _id: `${bookingId}-${index + 1}`,
        indications: pkg.indications,
        declared_value: null,
        reference: pkg.reference,
        counter_delivery: pkg.counter_delivery,
        size_cd: pkg.size_cd,
        status_cd: 0,
        tracking_link: null,
        picked_up_photo_url: null,
        delivered_photo_url: null,
        canceled_pickup_reason_cd: null,
        not_received_reason_cd: null,
      })),
    })),
  };
}

/**
 * Extrae el primer paquete de la respuesta de un booking. Mercamesa crea un
 * booking con una sola parada y un solo paquete por store_order, así que
 * este acceso es determinista.
 */
export function extractFirstPackage(booking: PiboxBookingResponse) {
  return booking.stops?.[0]?.packages?.[0] ?? null;
}
