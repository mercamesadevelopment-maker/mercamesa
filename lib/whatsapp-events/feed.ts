import type { SupabaseClient } from '@supabase/supabase-js';
import { getBuyerOrder, type BuyerOrderDetail } from '@/lib/orders/buyer-orders';
import { toAviso, toPickupCodeAviso, type Aviso, type BookingCodes } from './build-payload';
import { pickupRecipients } from './recipients';
import {
  feedWindow,
  isNotifiable,
  nextCursor,
  pickupHandlerRole,
  PICKUP_AVISOS,
  skipReason,
  type EventRow,
  type FeedQuery,
  type Recipient,
} from './rules';

const CON_RESERVA = new Set(['codigo_recogida', 'domicilio_recogido']);
const PARTE_FUERA = ['cancelled', 'returned'];

/** La reserva de cada evento con código: la de su parte o, si es consolidada, la del pedido. */
const bookingKey = (orderId: string, storeOrderId: string | null) => storeOrderId ?? `pedido:${orderId}`;

async function readBookings(service: SupabaseClient<any>, events: EventRow[]): Promise<Map<string, BookingCodes>> {
  const conReserva = events.filter((e) => CON_RESERVA.has(e.event_type));
  const partIds = [...new Set(conReserva.map((e) => e.store_order_id).filter(Boolean))] as string[];
  const orderIds = [...new Set(conReserva.filter((e) => !e.store_order_id).map((e) => e.order_id))];
  const columns = 'order_id, store_order_id, is_active, updated_at, pickup_validation_code, validation_code, driver_name, vehicle_plates';

  const rows: any[] = [];
  for (const [column, ids] of [['store_order_id', partIds], ['order_id', orderIds]] as const) {
    if (ids.length === 0) continue;
    const { data, error } = await service.from('pibox_bookings').select(columns).in(column, ids);
    if (error) throw new Error(`No se pudieron leer las reservas: ${error.message}`);
    rows.push(...(data ?? []));
  }

  // La activa primero y, entre iguales, la más reciente.
  rows.sort((a, b) => Number(b.is_active) - Number(a.is_active) || String(b.updated_at).localeCompare(String(a.updated_at)));
  const byKey = new Map<string, BookingCodes>();
  for (const r of rows) {
    const key = r.store_order_id ?? `pedido:${r.order_id}`;
    if (!byKey.has(key)) byKey.set(key, r as BookingCodes);
  }
  return byKey;
}

/**
 * Lo que Meteor consulta cada cierto tiempo: los avisos nuevos desde su cursor.
 *
 * Un evento que no se avisa (teléfono sin verificar, avisos apagados, un estado
 * intermedio de un pedido de varias tiendas) no sale, pero el cursor igual pasa
 * por encima: no tiene sentido volver a leerlo.
 *
 * El código de recogida sale como un aviso por cada persona que entrega el
 * paquete (`pickupHandlerRole`); el resto, uno al comprador.
 */
export async function readFeed(
  service: SupabaseClient<any>,
  { desde, limite }: FeedQuery,
  now = new Date()
): Promise<{ avisos: Aviso[]; siguiente: number }> {
  const { desdeFecha, hasta } = feedWindow(desde, now);

  let query = service
    .from('whatsapp_events')
    .select('seq, id, event_type, order_id, store_order_id, status_to, created_at')
    .gt('seq', desde)
    .lte('created_at', hasta)
    .order('seq', { ascending: true })
    .limit(limite);
  if (desdeFecha) query = query.gte('created_at', desdeFecha);

  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron leer los avisos: ${error.message}`);
  const events = (data ?? []) as EventRow[];
  if (events.length === 0) return { avisos: [], siguiente: desde };

  const orderIds = [...new Set(events.map((e) => e.order_id))];
  const partIds = [...new Set(events.map((e) => e.store_order_id).filter(Boolean))] as string[];

  const { data: orders, error: ordersError } = await service
    .from('orders')
    .select('id, code, buyer_id, fulfillment, runner_required, logistics_required')
    .in('id', orderIds);
  if (ordersError) throw new Error(`No se pudieron leer los pedidos: ${ordersError.message}`);
  const orderById = new Map((orders ?? []).map((o: any) => [o.id, o]));

  const buyerIds = [...new Set((orders ?? []).map((o: any) => o.buyer_id))];
  const { data: buyers, error: buyersError } = await service
    .from('profiles')
    .select('id, full_name, phone, phone_verified_at, whatsapp_notifications, is_active')
    .in('id', buyerIds);
  if (buyersError) throw new Error(`No se pudieron leer los compradores: ${buyersError.message}`);
  const buyerById = new Map((buyers ?? []).map((b: any) => [b.id, b as Recipient]));

  // Las partes de los avisos y, para el código de recogida, todas las del pedido.
  const pickupOrderIds = [...new Set(events.filter((e) => PICKUP_AVISOS.has(e.event_type)).map((e) => e.order_id))];
  const partsFilter = [
    partIds.length ? `id.in.(${partIds.join(',')})` : null,
    pickupOrderIds.length ? `order_id.in.(${pickupOrderIds.join(',')})` : null,
  ].filter(Boolean);
  const { data: parts, error: partsError } = partsFilter.length
    ? await service.from('store_orders').select('id, order_id, code, store_id, status, stores ( name )').or(partsFilter.join(','))
    : { data: [], error: null };
  if (partsError) throw new Error(`No se pudieron leer las partes: ${partsError.message}`);
  const partById = new Map((parts ?? []).map((p: any) => [p.id, p]));
  const partCodeById = new Map((parts ?? []).map((p: any) => [p.id, p.code as string]));

  const bookings = await readBookings(service, events);

  // Un pedido con varios avisos en la misma página se lee una sola vez.
  const details = new Map<string, Promise<BuyerOrderDetail | null>>();
  const avisos: Aviso[] = [];

  for (const ev of events) {
    const order = orderById.get(ev.order_id);
    if (!order) continue;

    if (PICKUP_AVISOS.has(ev.event_type)) {
      const booking = bookings.get(bookingKey(ev.order_id, ev.store_order_id));
      if (!booking?.pickup_validation_code) continue;

      const part = ev.store_order_id ? partById.get(ev.store_order_id) : null;
      const orderParts = part
        ? [part]
        : (parts ?? []).filter((p: any) => p.order_id === order.id && !PARTE_FUERA.includes(p.status));
      const rol = pickupHandlerRole(order.fulfillment, {
        runnerRequired: !!order.runner_required,
        logisticsRequired: !!order.logistics_required,
      });
      const recipients = await pickupRecipients(
        service,
        rol,
        order.id,
        orderParts.map((p: any) => p.store_id)
      );
      const ctx = {
        orderCode: order.code,
        part: part ? { codigo: part.code, tienda: part.stores?.name ?? '' } : null,
        tiendas: orderParts.map((p: any) => p.stores?.name ?? '').filter(Boolean),
        booking,
      };
      for (const r of recipients) {
        if (!skipReason(r)) avisos.push(toPickupCodeAviso(ev, r, ctx));
      }
      continue;
    }

    const recipient = buyerById.get(order.buyer_id) ?? null;
    if (skipReason(recipient) || !isNotifiable(ev, order.fulfillment)) continue;

    if (!details.has(order.id)) details.set(order.id, getBuyerOrder(service, order.buyer_id, order.code));
    const detail = await details.get(order.id)!;
    if (!detail) continue;

    avisos.push(
      toAviso(
        ev,
        detail,
        recipient!,
        ev.store_order_id ? partCodeById.get(ev.store_order_id) ?? null : null,
        bookings.get(bookingKey(ev.order_id, ev.store_order_id)) ?? null
      )
    );
  }

  return { avisos, siguiente: nextCursor(desde, events) };
}
