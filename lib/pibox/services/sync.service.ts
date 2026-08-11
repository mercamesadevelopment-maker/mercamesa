import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Json } from '@/types/database_generated';
import { fromSubUnits } from '../constants';
import { extractFirstPackage } from './booking.service';
import type { OrderStatus } from '../status-map';
import type { PiboxBookingResponse } from '../types';

/**
 * Guarda/actualiza el snapshot de un booking de Pibox.
 * Se llama al crear el domicilio, al recibir un webhook y desde el cron.
 */
export async function persistBookingSnapshot(
  storeOrderId: string,
  booking: PiboxBookingResponse
): Promise<void> {
  const db = createSupabaseServiceClient();
  const pkg = extractFirstPackage(booking);

  const snapshot = {
    store_order_id: storeOrderId,
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

/** Resuelve a qué store_order pertenece un booking o paquete de Pibox. */
export async function findStoreOrderIdByBooking(
  bookingId: string
): Promise<string | null> {
  const db = createSupabaseServiceClient();
  const { data } = await db
    .from('pibox_bookings')
    .select('store_order_id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  return data?.store_order_id ?? null;
}

export async function findStoreOrderIdByPackage(
  packageId: string
): Promise<string | null> {
  const db = createSupabaseServiceClient();
  const { data } = await db
    .from('pibox_bookings')
    .select('store_order_id')
    .eq('package_id', packageId)
    .maybeSingle();

  return data?.store_order_id ?? null;
}
