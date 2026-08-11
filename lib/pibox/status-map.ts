import type { Database } from '@/types/database_generated';
import {
  PIBOX_BOOKING_STATUS,
  PIBOX_BOOKING_STATUS_LABEL,
  PIBOX_PACKAGE_STATUS,
  PIBOX_PACKAGE_STATUS_LABEL,
  PIBOX_NOT_RECEIVED_REASON_LABEL,
  PIBOX_PICKUP_CANCEL_REASON_LABEL,
} from './constants';

export type OrderStatus = Database['public']['Enums']['order_status'];

/**
 * El enum order_status de Mercamesa es más grueso que los estados de Pibox:
 * varios estados de Pibox caen en el mismo nuestro. Cuando no hay un
 * equivalente (o el cambio requiere intervención humana) se devuelve null y
 * el estado de la orden se deja intacto — el detalle igual queda en las notas
 * del histórico, así que no se pierde información.
 */
export function piboxBookingStatusToOrderStatus(statusCd: number): OrderStatus | null {
  switch (statusCd) {
    case PIBOX_BOOKING_STATUS.ON_BOARD: // 6 Paquete a bordo
    case PIBOX_BOOKING_STATUS.DELIVERING: // 7 Entregando paquete
      return 'dispatched';
    case PIBOX_BOOKING_STATUS.FINISHED: // 4 Pedido finalizado
      return 'delivered';
    case PIBOX_BOOKING_STATUS.CANCELED_BY_PASSENGER: // 102
      return 'cancelled';
    // 0 Buscando conductor, 1 Conductor en camino, 5 Recogiendo, 109 Programado
    // → el paquete sigue en la tienda: se mantiene at_collection.
    // 100 Cancelado por conductor → Pibox relanza solo (relaunched_to_id).
    // 101 Expirado sin conductor → requiere acción humana.
    default:
      return null;
  }
}

export function piboxPackageStatusToOrderStatus(statusCd: number): OrderStatus | null {
  switch (statusCd) {
    case PIBOX_PACKAGE_STATUS.PICKED_UP: // 1
      return 'dispatched';
    case PIBOX_PACKAGE_STATUS.DELIVERED: // 2
      return 'delivered';
    case PIBOX_PACKAGE_STATUS.NOT_RECEIVED: // 4
    case PIBOX_PACKAGE_STATUS.RETURNED: // 5
      return 'returned';
    // 0 Esperando recogida, 3 Cancelado, 6 En bodega → sin cambio automático
    default:
      return null;
  }
}

/** Estados de Pibox que ameritan avisarle a alguien aunque no cambien la orden. */
export function piboxBookingStatusNeedsAttention(statusCd: number): boolean {
  return (
    statusCd === PIBOX_BOOKING_STATUS.EXPIRED_NO_DRIVER ||
    statusCd === PIBOX_BOOKING_STATUS.CANCELED_BY_DRIVER
  );
}

/**
 * Texto que se guarda en store_order_status_history.notes. Acá es donde se
 * conserva la granularidad que se pierde al mapear a nuestro enum.
 */
export function buildBookingStatusNote(
  statusCd: number,
  extra?: { driverName?: string | null; vehiclePlates?: string | null }
): string {
  const label = PIBOX_BOOKING_STATUS_LABEL[statusCd] ?? `estado ${statusCd}`;
  const parts: string[] = [`Pibox: ${label}`];

  if (extra?.driverName) {
    const vehicle = extra.vehiclePlates ? ` (${extra.vehiclePlates})` : '';
    parts.push(`Conductor: ${extra.driverName}${vehicle}`);
  }

  return parts.join(' — ');
}

export function buildPackageStatusNote(
  statusCd: number,
  extra?: { notReceivedReasonCd?: number | null; canceledPickupReasonCd?: number | null }
): string {
  const label = PIBOX_PACKAGE_STATUS_LABEL[statusCd] ?? `estado ${statusCd}`;
  const parts: string[] = [`Pibox: ${label}`];

  if (extra?.notReceivedReasonCd !== null && extra?.notReceivedReasonCd !== undefined) {
    const reason = PIBOX_NOT_RECEIVED_REASON_LABEL[extra.notReceivedReasonCd];
    if (reason) parts.push(`Motivo: ${reason}`);
  }

  if (extra?.canceledPickupReasonCd !== null && extra?.canceledPickupReasonCd !== undefined) {
    const reason = PIBOX_PICKUP_CANCEL_REASON_LABEL[extra.canceledPickupReasonCd];
    if (reason) parts.push(`No se pudo recoger: ${reason}`);
  }

  return parts.join(' — ');
}
