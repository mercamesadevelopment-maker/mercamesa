import { PIBOX_BOOKING_STATUS } from '@/lib/pibox/constants';
import type { Database } from '@/types/database_generated';

type OrderStatus = Database['public']['Enums']['order_status'];

/**
 * Qué pasa con el mensajero de Pibox cuando se regresa una parte a un estado
 * anterior.
 *
 * Volver a un estado anterior a «Listo Recogida» quiere decir que el paquete no
 * está listo: si hay un mensajero pedido, viene a recoger algo que no está.
 * En MM-2026-001100 (22 de noviembre) la tienda cerró, se regresó la parte a
 * «Empacando» y la reserva siguió viva: llegaron tres conductores a la tienda
 * cerrada. Por eso se cancela antes de regresar el estado.
 *
 * Si el conductor ya tiene el paquete, regresar el estado no lo devuelve a la
 * tienda: no se deja.
 */

/** Estados anteriores a «Listo Recogida»: el paquete todavía no está para recoger. */
const ANTES_DE_RECOGER: OrderStatus[] = ['pending', 'paid', 'confirmed', 'packing'];

/** El mensajero todavía no tiene el paquete: se puede cancelar. */
const CANCELABLE: number[] = [
  PIBOX_BOOKING_STATUS.SEARCHING_DRIVER,
  PIBOX_BOOKING_STATUS.DRIVER_ON_THE_WAY,
  PIBOX_BOOKING_STATUS.PICKING_UP,
  PIBOX_BOOKING_STATUS.SCHEDULED,
];

/** El paquete ya va con el conductor. */
const CON_EL_PAQUETE: number[] = [PIBOX_BOOKING_STATUS.ON_BOARD, PIBOX_BOOKING_STATUS.DELIVERING];

export const COURIER_HAS_PACKAGE_MESSAGE =
  'El domiciliario ya tiene el paquete: no se puede regresar el pedido a un estado anterior.';

export interface RevertBooking {
  booking_id: string;
  /** Pibox relanza la reserva cuando un conductor cancela: la búsqueda vigente es la del último id. */
  relaunched_to_booking_id: string | null;
  status_cd: number | null;
}

export type CourierDecision =
  | { action: 'keep' }
  | { action: 'cancel'; bookingId: string }
  | { action: 'block'; message: string };

export function decideCourierOnRevert(input: { target: OrderStatus; booking: RevertBooking | null }): CourierDecision {
  const { target, booking } = input;
  if (!ANTES_DE_RECOGER.includes(target) || !booking) return { action: 'keep' };

  const status = booking.status_cd ?? PIBOX_BOOKING_STATUS.SEARCHING_DRIVER;
  if (CON_EL_PAQUETE.includes(status)) return { action: 'block', message: COURIER_HAS_PACKAGE_MESSAGE };
  // Un conductor canceló (100) y Pibox relanzó: la búsqueda sigue en el id nuevo.
  const relanzada = status === PIBOX_BOOKING_STATUS.CANCELED_BY_DRIVER && Boolean(booking.relaunched_to_booking_id);
  if (CANCELABLE.includes(status) || relanzada) {
    // Cancelar el id original no detiene una búsqueda relanzada.
    return { action: 'cancel', bookingId: booking.relaunched_to_booking_id || booking.booking_id };
  }
  // Terminada (4) o ya cerrada: no hay a quién avisar.
  return { action: 'keep' };
}
