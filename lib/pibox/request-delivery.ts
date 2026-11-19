import type { SupabaseClient } from '@supabase/supabase-js';
import { createBooking, loadBookingContext, buildBookingPayload, PiboxDataError } from '@/lib/pibox';
import { persistBookingSnapshot } from '@/lib/pibox/services/sync.service';
import { requestCourierIfReady } from '@/lib/orders/consolidated-order';
import { carrierOf, receiverOf } from '@/lib/orders/consolidation';
import { notifyMarketplaceStaffOfOrder } from '@/lib/marketplace-staff/notify';

/**
 * Pide el mensajero de una parte que quedó «Listo Recogida». Lo usan el botón
 * del panel (`POST /api/pibox/bookings`) y el chat del tendero
 * (`cambiar_estado_subpedido`), para que los dos hagan lo mismo.
 *
 * En un pedido de varias tiendas ninguna pide su propio mensajero: sale uno
 * solo desde la bahía (`lib/orders/consolidation.ts`). Acá se avisa al equipo
 * de la plaza que la parte está lista y, si la plaza no tiene ni patinador ni
 * logística, se pide el mensajero cuando la última tienda queda lista.
 *
 * Quien llama ya comprobó que la persona maneja esa parte. `service` es el
 * cliente de servicio: el contexto trae el nombre, el teléfono y la dirección
 * del comprador, que la tienda no lee directo en la base.
 */

export type DeliveryRequest =
  | { kind: 'consolidated'; requested: boolean; error: string | null }
  | { kind: 'existing'; booking: Record<string, unknown> }
  | { kind: 'created'; booking: Record<string, unknown> | null };

export async function requestDeliveryForStoreOrder(
  service: SupabaseClient<any>,
  storeOrderId: string,
  actorId: string
): Promise<DeliveryRequest> {
  const { data: parte } = await service
    .from('store_orders')
    .select('order_id, code, stores ( name ), orders ( fulfillment, runner_required, logistics_required )')
    .eq('id', storeOrderId)
    .maybeSingle();

  const pedido = (parte as any)?.orders;
  if (pedido?.fulfillment === 'consolidated') {
    const cfg = { runnerRequired: Boolean(pedido.runner_required), logisticsRequired: Boolean(pedido.logistics_required) };
    const tienda = (parte as any).stores?.name ?? 'Una tienda';
    if (carrierOf(cfg) === 'runner') {
      await notifyMarketplaceStaffOfOrder(
        parte!.order_id,
        'Pedido listo para recoger',
        `${tienda} ya tiene lista su parte del pedido ${parte!.code}.`,
        ['runner']
      );
    } else if (receiverOf(cfg) === 'logistics') {
      await notifyMarketplaceStaffOfOrder(
        parte!.order_id,
        'Una tienda lleva su parte a la bahía',
        `${tienda} tiene lista su parte del pedido ${parte!.code} y la lleva a la bahía.`,
        ['logistics']
      );
    }
    const { data: perfil } = await service.from('profiles').select('phone').eq('id', actorId).maybeSingle();
    const outcome = await requestCourierIfReady(service, parte!.order_id, perfil?.phone ?? null, actorId);
    return { kind: 'consolidated', requested: outcome.requested, error: outcome.error };
  }

  // Idempotencia: si ya hay un domicilio vigente para este pedido, se devuelve
  // ese en vez de despachar un segundo mensajero. Una reserva sin conductor o
  // cancelada ya no es vigente (`is_active = false`), así que no bloquea.
  const { data: existing } = await service
    .from('pibox_bookings')
    .select('*')
    .eq('store_order_id', storeOrderId)
    .eq('is_active', true)
    // La base ya no admite dos activas por pedido (índice único); el
    // `limit(1)` es por si acaso: `maybeSingle` con dos filas daba error.
    .limit(1)
    .maybeSingle();
  if (existing) return { kind: 'existing', booking: existing };

  const context = await loadBookingContext(service, storeOrderId);

  // Solo se despacha lo que está pagado: ya no hay contraentrega. El
  // cotizador de la canasta usa el mismo armador del payload con el pago
  // «pendiente», por eso la regla vive acá y no allá.
  if (context.paymentStatus !== 'approved') {
    throw new PiboxDataError('El pago de este pedido aún no está aprobado: no se puede pedir el domiciliario.');
  }

  const booking = await createBooking(buildBookingPayload(context));
  await persistBookingSnapshot({ storeOrderId }, booking);

  const { data: saved } = await service.from('pibox_bookings').select('*').eq('booking_id', booking._id).maybeSingle();
  return { kind: 'created', booking: saved };
}
