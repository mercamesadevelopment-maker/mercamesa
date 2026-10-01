import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Json } from '@/types/database_generated';
import { fromSubUnits } from '../constants';
import { extractFirstPackage } from './booking.service';
import type { OrderStatus } from '../status-map';
import type { PiboxBookingResponse } from '../types';

/**
 * De quién es una reserva de Pibox.
 *
 * Lo normal es que sea de la parte de una tienda (`storeOrderId`): la tienda
 * marca «Listo Recogida» y se pide su mensajero. En un pedido de varias tiendas
 * la reserva es del pedido entero (`orderId`): la pide el patinador cuando todo
 * está en la bahía, y lo que le pase al mensajero les pasa a todas las partes.
 */
export type BookingOwner = { storeOrderId: string } | { orderId: string };

/** Las columnas de `pibox_bookings` que dicen de quién es la reserva. */
function ownerColumns(owner: BookingOwner): { store_order_id: string | null; order_id: string | null } {
  return 'orderId' in owner
    ? { store_order_id: null, order_id: owner.orderId }
    : { store_order_id: owner.storeOrderId, order_id: null };
}

/**
 * Guarda/actualiza el snapshot de un booking de Pibox.
 * Se llama al crear el domicilio, al recibir un webhook y desde el cron.
 */
export async function persistBookingSnapshot(
  owner: BookingOwner,
  booking: PiboxBookingResponse
): Promise<void> {
  const db = createSupabaseServiceClient();
  const pkg = extractFirstPackage(booking);

  const snapshot = {
    ...ownerColumns(owner),
    booking_id: booking._id,
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
    is_active: true,
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
 * Regla importante: solo escribe en store_order_status_history cuando el estado
 * mapeado difiere del actual. Sin esto, los cuatro estados de Pibox que caen en
 * `at_collection` generarían cuatro filas idénticas en el histórico.
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
  if (!nextStatus || storeOrder.status === nextStatus) return false;

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

function toOwner(row: { store_order_id: string | null; order_id: string | null } | null): BookingOwner | null {
  if (!row) return null;
  if (row.order_id) return { orderId: row.order_id };
  if (row.store_order_id) return { storeOrderId: row.store_order_id };
  return null;
}

/** De quién es un booking o paquete de Pibox, o `null` si no lo conocemos. */
export async function findBookingOwner(bookingId: string): Promise<BookingOwner | null> {
  const db = createSupabaseServiceClient();
  const { data } = await db
    .from('pibox_bookings')
    .select('store_order_id, order_id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  return toOwner(data);
}

export async function findBookingOwnerByPackage(packageId: string): Promise<BookingOwner | null> {
  const db = createSupabaseServiceClient();
  const { data } = await db
    .from('pibox_bookings')
    .select('store_order_id, order_id')
    .eq('package_id', packageId)
    .maybeSingle();

  return toOwner(data);
}

/** Estados en los que una parte ya no viaja con el pedido. */
const FUERA_DEL_DESPACHO: OrderStatus[] = ['cancelled', 'returned'];

/**
 * Las partes de tienda a las que les aplica lo que pase con la reserva.
 *
 * En una reserva de pedido son todas las que siguen en él: una tienda que
 * canceló su parte no viaja, así que el mensajero no puede «entregarla».
 */
export async function storeOrderIdsOf(owner: BookingOwner): Promise<string[]> {
  if ('storeOrderId' in owner) return [owner.storeOrderId];

  const db = createSupabaseServiceClient();
  const { data } = await db.from('store_orders').select('id, status').eq('order_id', owner.orderId);

  return (data ?? []).filter((so) => !FUERA_DEL_DESPACHO.includes(so.status)).map((so) => so.id);
}

/**
 * Aplica un estado de Pibox a todo lo que cubre la reserva.
 *
 * @returns true si cambió el estado de al menos una parte
 */
export async function applyStatusToOwner(
  owner: BookingOwner,
  nextStatus: OrderStatus | null,
  note: string
): Promise<boolean> {
  let changed = false;
  for (const storeOrderId of await storeOrderIdsOf(owner)) {
    if (await applyOrderStatusFromPibox(storeOrderId, nextStatus, note)) changed = true;
  }
  return changed;
}
