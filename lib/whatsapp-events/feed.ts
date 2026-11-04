import type { SupabaseClient } from '@supabase/supabase-js';
import { getBuyerOrder, type BuyerOrderDetail } from '@/lib/orders/buyer-orders';
import { toAviso, type Aviso } from './build-payload';
import {
  feedWindow,
  isNotifiable,
  nextCursor,
  skipReason,
  type EventRow,
  type FeedQuery,
  type Recipient,
} from './rules';

/**
 * Lo que Meteor consulta cada cierto tiempo: los avisos nuevos desde su cursor.
 *
 * Un evento que no se avisa (teléfono sin verificar, avisos apagados, un estado
 * intermedio de un pedido de varias tiendas) no sale, pero el cursor igual pasa
 * por encima: no tiene sentido volver a leerlo.
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
    .select('id, code, buyer_id, fulfillment')
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

  const { data: parts, error: partsError } = partIds.length
    ? await service.from('store_orders').select('id, code').in('id', partIds)
    : { data: [], error: null };
  if (partsError) throw new Error(`No se pudieron leer las partes: ${partsError.message}`);
  const partCodeById = new Map((parts ?? []).map((p: any) => [p.id, p.code as string]));

  // Un pedido con varios avisos en la misma página se lee una sola vez.
  const details = new Map<string, Promise<BuyerOrderDetail | null>>();
  const avisos: Aviso[] = [];

  for (const ev of events) {
    const order = orderById.get(ev.order_id);
    if (!order) continue;
    const recipient = buyerById.get(order.buyer_id) ?? null;
    if (skipReason(recipient) || !isNotifiable(ev, order.fulfillment)) continue;

    if (!details.has(order.id)) details.set(order.id, getBuyerOrder(service, order.buyer_id, order.code));
    const detail = await details.get(order.id)!;
    if (!detail) continue;

    avisos.push(toAviso(ev, detail, recipient!, ev.store_order_id ? partCodeById.get(ev.store_order_id) ?? null : null));
  }

  return { avisos, siguiente: nextCursor(desde, events) };
}
