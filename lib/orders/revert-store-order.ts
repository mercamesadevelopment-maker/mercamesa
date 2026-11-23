import type { SupabaseClient } from '@supabase/supabase-js';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { cancelBooking } from '@/lib/pibox/services/booking.service';
import { noteClosedBooking, persistBookingSnapshot, type BookingOwner } from '@/lib/pibox/services/sync.service';
import type { Database } from '@/types/database_generated';
import { decideCourierOnRevert, type RevertBooking } from './revert-courier';

type OrderStatus = Database['public']['Enums']['order_status'];

/**
 * Regresar una parte a un estado anterior (una corrección manual), cancelando
 * antes el mensajero de Pibox si el paquete ya no va a estar listo
 * (`decideCourierOnRevert`).
 *
 * El orden importa: primero se cancela el mensajero y después se cambia el
 * estado. Si Pibox no deja cancelar, el estado no se toca: es mejor un pedido que
 * sigue en «Listo Recogida» que un conductor llegando a una tienda cerrada.
 *
 * El cambio de estado lo hace `revert_store_order_status`, que valida en la base
 * quién puede (`p_actor`), que el destino esté en el historial y que la parte no
 * esté liquidada. Lo barato se valida acá antes, para no cancelar en vano.
 */

export type RevertResult =
  | { ok: true; courier: 'cancelled' | 'kept' }
  | { ok: false; status: number; message: string };

const falla = (status: number, message: string): RevertResult => ({ ok: false, status, message });

/** El código de error de Postgres, en el que dice la función. */
function statusOfDbError(code: string | undefined): number {
  if (code === '42501') return 403;
  if (code === 'P0002') return 404;
  return 409;
}

/** La reserva vigente de la parte, o la del pedido entero si es de varias tiendas. */
async function activeBooking(
  service: SupabaseClient<any>,
  part: { id: string; order_id: string; fulfillment: string | null }
): Promise<{ owner: BookingOwner; booking: RevertBooking } | null> {
  const owner: BookingOwner = part.fulfillment === 'consolidated' ? { orderId: part.order_id } : { storeOrderId: part.id };
  const columna = 'orderId' in owner ? 'order_id' : 'store_order_id';
  const valor = 'orderId' in owner ? owner.orderId : owner.storeOrderId;
  const { data, error } = await service
    .from('pibox_bookings')
    .select('booking_id, relaunched_to_booking_id, status_cd')
    .eq(columna, valor)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`No se pudo revisar el domiciliario: ${error.message}`);
  return data ? { owner, booking: data as RevertBooking } : null;
}

export async function revertStoreOrderWithCourier(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  input: { storeOrderId: string; target: OrderStatus; notes: string; userId: string }
): Promise<RevertResult> {
  const notes = input.notes.trim();
  if (!notes) return falla(400, 'La observación es obligatoria para regresar un pedido de estado.');

  const { data: part, error } = await service
    .from('store_orders')
    .select('id, order_id, store_id, status, orders ( fulfillment )')
    .eq('id', input.storeOrderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!part) return falla(404, 'El pedido no existe.');

  if (!(await canManageStore(supabase, (part as any).store_id, input.userId))) {
    return falla(403, 'No tienes permiso para modificar este pedido.');
  }
  if (input.target === (part as any).status) return falla(409, 'El pedido ya está en ese estado.');

  if (input.target !== 'pending') {
    const { count } = await service
      .from('store_order_status_history')
      .select('id', { count: 'exact', head: true })
      .eq('store_order_id', input.storeOrderId)
      .eq('status', input.target);
    if (!count) return falla(409, 'Solo puedes regresar a un estado por el que el pedido ya pasó.');
  }

  const vigente = await activeBooking(service, {
    id: (part as any).id,
    order_id: (part as any).order_id,
    fulfillment: (part as any).orders?.fulfillment ?? null,
  });
  const decision = decideCourierOnRevert({ target: input.target, booking: vigente?.booking ?? null });
  if (decision.action === 'block') return falla(409, decision.message);

  if (decision.action === 'cancel' && vigente) {
    try {
      const booking = await cancelBooking(decision.bookingId);
      await persistBookingSnapshot(vigente.owner, booking);
    } catch (e) {
      console.error('No se pudo cancelar el domiciliario al regresar el pedido:', e);
      return falla(
        502,
        'No se pudo cancelar el domiciliario en Pibox, así que el pedido no se regresó: sigue en «Listo Recogida». Intenta de nuevo.'
      );
    }
    await noteClosedBooking(vigente.owner, 'Se canceló el domiciliario en Pibox porque el pedido regresó a un estado anterior');
  }

  const { error: rpcError } = await service.rpc('revert_store_order_status', {
    p_store_order_id: input.storeOrderId,
    p_target_status: input.target,
    p_notes: notes,
    p_actor: input.userId,
  });
  if (rpcError) {
    const message =
      decision.action === 'cancel'
        ? `${rpcError.message} El domiciliario sí quedó cancelado: si el pedido sigue listo, se puede pedir otro.`
        : rpcError.message;
    return falla(statusOfDbError(rpcError.code), message);
  }

  return { ok: true, courier: decision.action === 'cancel' ? 'cancelled' : 'kept' };
}
