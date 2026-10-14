import {
  PIBOX_BOOKING_STATUS,
  PIBOX_BOOKING_STATUS_LABEL,
  PIBOX_PACKAGE_STATUS_LABEL,
  PIBOX_WEBHOOK_EVENT,
} from './constants';
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
  // Canceló el conductor: Picap relanza solo sobre la misma reserva, así que
  // para quien mira se está buscando otro conductor.
  if (s === PIBOX_BOOKING_STATUS.CANCELED_BY_DRIVER) return 'searching';
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
      row.status_cd === PIBOX_BOOKING_STATUS.CANCELED_BY_DRIVER
        ? 'Buscando otro conductor'
        : row.status_cd !== null && row.status_cd !== undefined
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

/** Una fila de `pibox_booking_events`, con lo que usa la línea de tiempo. */
export interface DeliveryEventRow {
  received_at: string;
  event_created_at: string | null;
  event_cd: number;
  status_cd: number | null;
  driver_name: string | null;
  store_order_id: string | null;
}

export interface DeliveryTimelineEntry {
  at: string;
  text: string;
  /** Para el color del punto: lo normal, lo que salió bien, lo que requiere atención. */
  tone: 'info' | 'ok' | 'warn';
}

function bookingEventText(status: number | null, driver: string | null): Pick<DeliveryTimelineEntry, 'text' | 'tone'> {
  const quien = driver?.trim() || 'El conductor';
  switch (status) {
    case PIBOX_BOOKING_STATUS.SEARCHING_DRIVER:
      return { text: 'Buscando conductor', tone: 'info' };
    case PIBOX_BOOKING_STATUS.DRIVER_ON_THE_WAY:
      return { text: driver ? `${quien} aceptó y va hacia la tienda` : 'Conductor asignado', tone: 'ok' };
    case PIBOX_BOOKING_STATUS.PICKING_UP:
      return { text: `${quien} está recogiendo en la tienda`, tone: 'info' };
    case PIBOX_BOOKING_STATUS.ON_BOARD:
      return { text: `${quien} recogió el pedido`, tone: 'ok' };
    case PIBOX_BOOKING_STATUS.DELIVERING:
      return { text: `${quien} está entregando`, tone: 'info' };
    case PIBOX_BOOKING_STATUS.FINISHED:
      return { text: 'Domicilio finalizado', tone: 'ok' };
    case PIBOX_BOOKING_STATUS.CANCELED_BY_DRIVER:
      return { text: `${quien} canceló; Picap busca otro conductor`, tone: 'warn' };
    case PIBOX_BOOKING_STATUS.EXPIRED_NO_DRIVER:
      return { text: 'Nadie tomó el domicilio', tone: 'warn' };
    case PIBOX_BOOKING_STATUS.CANCELED_BY_PASSENGER:
      return { text: 'Domicilio cancelado', tone: 'warn' };
    default:
      return {
        text: status !== null ? PIBOX_BOOKING_STATUS_LABEL[status] ?? `Estado ${status}` : 'Aviso de Picap',
        tone: 'info',
      };
  }
}

/**
 * La historia del domicilio en frases («Álvaro aceptó · Álvaro canceló ·
 * Mateo aceptó»), a partir de la bitácora de avisos de Picap.
 *
 * - Solo para la tienda y el admin: al comprador los cambios de conductor no le
 *   aportan y pueden inquietarlo; él ve el estado actual.
 * - En orden de ocurrencia (la fecha de Picap; si no viene, la de llegada).
 * - Sin los avisos que no se asociaron a un pedido, y sin repetir la misma
 *   frase seguida (Picap manda varios avisos por el mismo cambio).
 */
export function toDeliveryTimeline(
  events: DeliveryEventRow[],
  viewer: DeliveryViewer
): DeliveryTimelineEntry[] {
  if (viewer === 'buyer') return [];

  const ordenados = events
    .filter((e) => e.store_order_id)
    .map((e) => ({ e, at: e.event_created_at ?? e.received_at }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const out: DeliveryTimelineEntry[] = [];
  for (const { e, at } of ordenados) {
    const entry =
      e.event_cd === PIBOX_WEBHOOK_EVENT.PACKAGE_UPDATED
        ? {
            text: e.status_cd !== null ? PIBOX_PACKAGE_STATUS_LABEL[e.status_cd] ?? `Paquete: estado ${e.status_cd}` : 'Aviso del paquete',
            tone: 'info' as const,
          }
        : bookingEventText(e.status_cd, e.driver_name);

    if (out.length && out[out.length - 1].text === entry.text) continue;
    out.push({ at, ...entry });
  }
  return out;
}
