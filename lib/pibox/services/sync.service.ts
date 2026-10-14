import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Json } from '@/types/database_generated';
import { fromSubUnits } from '../constants';
import { extractFirstPackage, getBooking } from './booking.service';
import { isPiboxDryRun, PIBOX_SIMULATED_PREFIX } from '../client';
import { isForwardOrderStatus, piboxBookingIsClosed, type OrderStatus } from '../status-map';
import type { PiboxBookingResponse } from '../types';

/**
 * Guarda/actualiza el snapshot de un booking de Pibox.
 * Se llama al crear el domicilio, al recibir un webhook y desde el cron.
 *
 * Si Picap devuelve un id que solo conocemos como alias (un relanzamiento), se
 * guarda sobre la reserva principal: nunca se crea una fila por relanzamiento.
 */
export async function persistBookingSnapshot(
  storeOrderId: string,
  booking: PiboxBookingResponse
): Promise<void> {
  const db = createSupabaseServiceClient();
  const pkg = extractFirstPackage(booking);
  const known = await findBookingRow(booking._id);

  const snapshot = {
    store_order_id: storeOrderId,
    booking_id: known?.booking_id ?? booking._id,
    package_id: pkg?._id ?? null,
    status_cd: booking.status_cd ?? null,
    package_status_cd: pkg?.status_cd ?? null,
    tracking_link: pkg?.tracking_link ?? null,
    pickup_validation_code: booking.pickup_validation_code ?? null,
    validation_code: pkg?.validation_code ?? null,
    estimated_cost: fromSubUnits(booking.estimated_cost?.subunits),
    final_cost: fromSubUnits(booking.final_cost?.subunits),
    currency: booking.final_cost?.iso || booking.estimated_cost?.iso || 'COP',
    driver_name: booking.driver?.name ?? null,
    driver_phone: booking.driver?.phone ?? null,
    vehicle_plates: booking.served_vehicle?.plates ?? null,
    canceled_pickup_reason_cd: pkg?.canceled_pickup_reason_cd ?? null,
    not_received_reason_cd: pkg?.not_received_reason_cd ?? null,
    relaunched_to_booking_id: booking.relaunched_to_id ?? null,
    // Solo la cierran «sin conductor» y «cancelada por nosotros». Un
    // relanzamiento NO: Picap sigue usando esta misma reserva.
    is_active: !piboxBookingIsClosed(booking.status_cd),
    raw: booking as unknown as Json,
  };

  const { error } = await db
    .from('pibox_bookings')
    .upsert(snapshot, { onConflict: 'booking_id' });

  if (error) {
    console.error('Error guardando el snapshot del booking de Pibox:', error.message);
  }
}

/**
 * Aplica un estado a la orden de tienda.
 *
 * Reglas:
 * - Solo escribe en store_order_status_history cuando el estado cambia. Sin
 *   esto, los cuatro estados de Pibox que caen en `at_collection` generarían
 *   cuatro filas idénticas en el histórico.
 * - Solo avanza (`isForwardOrderStatus`): Pibox no promete el orden de los
 *   eventos, y uno atrasado no puede devolver un pedido ya entregado.
 *
 * `changed_by` queda en null: así se distinguen los cambios automáticos de
 * Pibox de los que hizo una persona.
 *
 * @returns true si el estado efectivamente cambió
 */
export async function applyOrderStatusFromPibox(
  storeOrderId: string,
  nextStatus: OrderStatus | null,
  note: string
): Promise<boolean> {
  const supabase = createSupabaseServiceClient();

  const { data: storeOrder, error: fetchError } = await supabase
    .from('store_orders')
    .select('id, status')
    .eq('id', storeOrderId)
    .single();

  if (fetchError || !storeOrder) {
    console.error('No se encontró el store_order para sincronizar:', fetchError?.message);
    return false;
  }

  // Sin equivalente en nuestro enum, o el estado no cambió: no se toca la orden
  // ni se ensucia el histórico con filas repetidas.
  if (!nextStatus || !isForwardOrderStatus(storeOrder.status as OrderStatus, nextStatus)) return false;

  const { error: updateError } = await supabase
    .from('store_orders')
    .update({ status: nextStatus })
    .eq('id', storeOrderId);

  if (updateError) {
    console.error('Error actualizando el estado del store_order:', updateError.message);
    return false;
  }

  const { error: historyError } = await supabase.from('store_order_status_history').insert({
    store_order_id: storeOrderId,
    status: nextStatus,
    notes: note,
    changed_by: null,
  });

  if (historyError) {
    console.error('Error escribiendo el histórico de estado:', historyError.message);
  }

  return true;
}

export interface BookingRef {
  booking_id: string;
  store_order_id: string;
}

/** La reserva cuyo id o alias es `bookingId`. */
async function findBookingRow(bookingId: string): Promise<BookingRef | null> {
  const db = createSupabaseServiceClient();
  const { data } = await db
    .from('pibox_bookings')
    .select('booking_id, store_order_id')
    .or(`booking_id.eq.${bookingId},alias_booking_ids.cs.{${bookingId}}`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** El pedido de una reserva, por su id o un alias. Sin reintentos. */
export async function findStoreOrderIdByBooking(bookingId: string): Promise<string | null> {
  return (await findBookingRow(bookingId))?.store_order_id ?? null;
}

async function findPackageRow(packageId: string): Promise<BookingRef | null> {
  const db = createSupabaseServiceClient();
  const { data } = await db
    .from('pibox_bookings')
    .select('booking_id, store_order_id')
    .eq('package_id', packageId)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Esperas antes de dar un aviso por desconocido. Picap avisa de una reserva
 * nueva antes de que nuestro POST termine de guardarla (en producción, ~0,6 s
 * antes), y los avisos de un relanzamiento pueden llegar antes que el que
 * trae el `relaunched_to_id`.
 */
const RETRY_DELAYS_MS = [800, 1500];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetries(
  find: () => Promise<BookingRef | null>,
  delays: number[]
): Promise<BookingRef | null> {
  let found = await find();
  for (const ms of delays) {
    if (found) break;
    await sleep(ms);
    found = await find();
  }
  return found;
}

/**
 * A qué reserva (y pedido) pertenece un aviso de Pibox.
 *
 * 1. Por id o por alias.
 * 2. Si no aparece, reintenta (ver `RETRY_DELAYS_MS`).
 * 3. Si sigue sin aparecer, le pregunta a Picap: `GET /bookings/{id}` devuelve
 *    la reserva principal aunque se le pida un id de relanzamiento. Si esa la
 *    conocemos, el id del aviso queda como alias para la próxima.
 *
 * `null` si no es de ningún pedido nuestro: el aviso queda en la bitácora y la
 * sincronización pone al día la reserva después.
 */
export async function resolveBooking(
  eventBookingId: string,
  delays: number[] = RETRY_DELAYS_MS
): Promise<BookingRef | null> {
  const found = await withRetries(() => findBookingRow(eventBookingId), delays);
  if (found) return found;

  if (eventBookingId.startsWith(PIBOX_SIMULATED_PREFIX) || isPiboxDryRun()) return null;

  try {
    const booking = await getBooking(eventBookingId);
    if (!booking?._id || booking._id === eventBookingId) return null;
    const principal = await findBookingRow(booking._id);
    if (principal) await addBookingAlias(principal.booking_id, eventBookingId);
    return principal;
  } catch (error: unknown) {
    console.error(
      'No se pudo consultar en Pibox la reserva del aviso:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function resolvePackage(
  packageId: string,
  delays: number[] = RETRY_DELAYS_MS
): Promise<BookingRef | null> {
  return withRetries(() => findPackageRow(packageId), delays);
}

/** Registra un id de relanzamiento de Picap como alias de la reserva principal. */
export async function addBookingAlias(bookingId: string, alias: string): Promise<void> {
  if (!alias || alias === bookingId) return;
  const db = createSupabaseServiceClient();
  const { data } = await db
    .from('pibox_bookings')
    .select('alias_booking_ids')
    .eq('booking_id', bookingId)
    .maybeSingle();
  const actuales: string[] = data?.alias_booking_ids ?? [];
  if (actuales.includes(alias)) return;

  const { error } = await db
    .from('pibox_bookings')
    .update({ alias_booking_ids: [...actuales, alias] })
    .eq('booking_id', bookingId);
  if (error) console.error('No se pudo guardar el alias de la reserva:', error.message);
}

export interface BookingEventRecord {
  storeOrderId: string | null;
  bookingId: string | null;
  eventBookingId: string | null;
  packageId: string | null;
  eventCd: number;
  statusCd: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  vehiclePlates?: string | null;
  relaunchedToId?: string | null;
  eventCreatedAt?: string | null;
  payload: unknown;
}

/**
 * Guarda el aviso en la bitácora (`pibox_booking_events`). Todos, también los
 * atrasados y los que no se pudieron asociar: es la historia completa del
 * domicilio. Un fallo acá no detiene el procesamiento del aviso.
 */
export async function recordBookingEvent(e: BookingEventRecord): Promise<void> {
  const db = createSupabaseServiceClient();
  const at = e.eventCreatedAt ? new Date(e.eventCreatedAt) : null;

  const { error } = await db.from('pibox_booking_events').insert({
    store_order_id: e.storeOrderId,
    booking_id: e.bookingId,
    event_booking_id: e.eventBookingId,
    package_id: e.packageId,
    event_cd: e.eventCd,
    status_cd: e.statusCd,
    driver_name: e.driverName ?? null,
    driver_phone: e.driverPhone ?? null,
    vehicle_plates: e.vehiclePlates ?? null,
    relaunched_to_id: e.relaunchedToId ?? null,
    event_created_at: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
    payload: e.payload as Json,
  });
  if (error) console.error('No se pudo registrar el aviso de Pibox en la bitácora:', error.message);
}

/**
 * Deja en el histórico que el domicilio se cerró sin entregar (sin conductor o
 * cancelado), sin cambiar el estado del pedido: sigue en «Listo Recogida» y la
 * tienda puede pedir otro domiciliario.
 */
export async function noteClosedBooking(storeOrderId: string, note: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { data: storeOrder } = await supabase
    .from('store_orders')
    .select('status')
    .eq('id', storeOrderId)
    .maybeSingle();

  if (!storeOrder) return;

  const { error } = await supabase.from('store_order_status_history').insert({
    store_order_id: storeOrderId,
    status: storeOrder.status,
    notes: `${note}. Se puede solicitar otro domiciliario.`,
    changed_by: null,
  });

  if (error) console.error('Error registrando el cierre del domicilio:', error.message);
}

/**
 * Si el evento es más viejo que el último aplicado a la reserva, se descarta.
 * Pibox no promete el orden de los webhooks. Devuelve true si se debe aplicar
 * y, en ese caso, deja guardada la fecha.
 */
export async function claimBookingEvent(
  match: { booking_id: string } | { package_id: string },
  eventCreatedAt: string | null | undefined
): Promise<boolean> {
  if (!eventCreatedAt) return true;
  const at = new Date(eventCreatedAt);
  if (Number.isNaN(at.getTime())) return true;

  const db = createSupabaseServiceClient();
  const byBooking = 'booking_id' in match;
  const column = byBooking ? 'booking_id' : 'package_id';
  const value = byBooking ? match.booking_id : match.package_id;

  const { data } = await db
    .from('pibox_bookings')
    .select('last_event_at')
    .eq(column, value)
    .maybeSingle();

  const last = (data as { last_event_at: string | null } | null)?.last_event_at;
  if (last && new Date(last) > at) return false;

  await db.from('pibox_bookings').update({ last_event_at: at.toISOString() }).eq(column, value);
  return true;
}
