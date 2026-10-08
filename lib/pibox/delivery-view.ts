import { PIBOX_BOOKING_STATUS, PIBOX_BOOKING_STATUS_LABEL, PIBOX_PACKAGE_STATUS_LABEL } from './constants';
import { piboxBookingIsClosed } from './status-map';
import type { PiboxBookingRow } from './types';

/** Quién mira el domicilio. Decide qué campos se le muestran. */
export type DeliveryViewer = 'buyer' | 'store' | 'admin';

/** En qué va el domicilio, en el lenguaje de las pantallas. */
export type DeliveryStage =
  | 'searching' // buscando conductor
  | 'assigned' // conductor asignado, va hacia la tienda
  | 'picking_up' // recogiendo en la tienda
  | 'on_the_way' // con el paquete, hacia el comprador
  | 'delivered'
  | 'scheduled'
  | 'closed'; // sin conductor o cancelado: hay que pedir otro

/** Lo que devuelve `GET /api/pibox/bookings`. Nunca incluye `raw`. */
export interface DeliveryView {
  bookingId: string;
  stage: DeliveryStage;
  statusLabel: string;
  packageStatusLabel: string | null;
  driver: { name: string | null; phone: string | null; plates: string | null } | null;
  trackingLink: string | null;
  updatedAt: string;
  /** Solo tienda y admin: lo que cuesta el domicilio. */
  cost?: number | null;
  /** Solo tienda y admin: el código que se valida con el conductor al recoger. */
  pickupValidationCode?: string | null;
  /** Solo comprador y admin: el código del paquete en la entrega. */
  deliveryValidationCode?: string | null;
  /** Solo admin: id de Pibox de la reserva que la reemplazó al relanzarse. */
  relaunchedTo?: string | null;
  isActive: boolean;
}

export function deliveryStage(row: Pick<PiboxBookingRow, 'status_cd' | 'package_status_cd'>): DeliveryStage {
  const s = row.status_cd;
  if (piboxBookingIsClosed(s)) return 'closed';
  // Canceló el conductor y no hay sucesora todavía: para quien mira, es lo mismo.
  if (s === PIBOX_BOOKING_STATUS.CANCELED_BY_DRIVER) return 'closed';
  if (s === PIBOX_BOOKING_STATUS.FINISHED || row.package_status_cd === 2) return 'delivered';
  if (s === PIBOX_BOOKING_STATUS.ON_BOARD || s === PIBOX_BOOKING_STATUS.DELIVERING) return 'on_the_way';
  if (s === PIBOX_BOOKING_STATUS.PICKING_UP) return 'picking_up';
  if (s === PIBOX_BOOKING_STATUS.DRIVER_ON_THE_WAY) return 'assigned';
  if (s === PIBOX_BOOKING_STATUS.SCHEDULED) return 'scheduled';
  return 'searching';
}

/**
 * Recorta una fila de `pibox_bookings` a lo que puede ver cada rol.
 *
 * El conductor y el enlace de seguimiento los ven todos: son los que permiten
 * seguir el pedido y llamar al mensajero. El costo y el código de recogida son
 * de la tienda; el código de entrega, del comprador.
 */
export function toDeliveryView(row: PiboxBookingRow, viewer: DeliveryViewer): DeliveryView {
  const hasDriver = !!(row.driver_name || row.driver_phone || row.vehicle_plates);

  const view: DeliveryView = {
    bookingId: row.booking_id,
    stage: deliveryStage(row),
    statusLabel:
      row.status_cd !== null && row.status_cd !== undefined
        ? PIBOX_BOOKING_STATUS_LABEL[row.status_cd] ?? `Estado ${row.status_cd}`
        : 'Solicitando domiciliario',
    packageStatusLabel:
      row.package_status_cd !== null && row.package_status_cd !== undefined
        ? PIBOX_PACKAGE_STATUS_LABEL[row.package_status_cd] ?? null
        : null,
    driver: hasDriver
      ? { name: row.driver_name, phone: row.driver_phone, plates: row.vehicle_plates }
      : null,
    trackingLink: row.tracking_link,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  };

  if (viewer !== 'buyer') {
    view.cost = row.final_cost ?? row.estimated_cost ?? null;
    view.pickupValidationCode = row.pickup_validation_code;
  }
  if (viewer !== 'store') {
    view.deliveryValidationCode = row.validation_code;
  }
  if (viewer === 'admin') {
    view.relaunchedTo = row.relaunched_to_booking_id;
  }

  return view;
}
