import type { SupabaseClient } from '@supabase/supabase-js';
import { toDeliveryView } from '@/lib/pibox/delivery-view';
import type { PiboxBookingRow } from '@/lib/pibox/types';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from './status-labels';

/**
 * Los pedidos de un comprador vistos desde afuera de la app (el chat de Meteor):
 * el pedido completo y, dentro, una parte por tienda.
 *
 * Todo se lee con el cliente de servicio y siempre filtrado por `buyerId`: quien
 * llama ya sabe quién es el comprador. Los códigos de entrega y de recogida de
 * Pibox nunca salen (IMP-07): ni siquiera se le piden a la base.
 */

const label = (labels: Record<string, string>, value: string | null) => (value ? labels[value] ?? value : null);

export interface BuyerOrderPart {
  code: string;
  storeName: string;
  status: string;
  statusLabel: string | null;
}

export interface BuyerOrderSummary {
  code: string;
  createdAt: string;
  /** El estado del pedido completo, como está guardado en `orders.status`. */
  status: string;
  statusLabel: string | null;
  paymentStatus: string;
  paymentStatusLabel: string | null;
  total: number;
  parts: BuyerOrderPart[];
}

export interface OrderRow {
  id: string;
  code: string;
  created_at: string;
  status: string;
  payment_status: string;
  total: number;
}

export interface PartRow {
  id: string;
  order_id: string;
  store_id: string;
  code: string;
  status: string;
  split_index: number;
  stores: { name: string } | null;
}

function toPart(p: PartRow): BuyerOrderPart {
  return {
    code: p.code,
    storeName: p.stores?.name ?? '',
    status: p.status,
    statusLabel: label(ORDER_STATUS_LABELS, p.status),
  };
}

const bySplit = (a: PartRow, b: PartRow) => a.split_index - b.split_index;

/** Une cada pedido con sus partes, en el orden en que se crearon. Sin base. */
export function toOrderSummaries(orders: OrderRow[], parts: PartRow[]): BuyerOrderSummary[] {
  return orders.map((o) => ({
    code: o.code,
    createdAt: o.created_at,
    status: o.status,
    statusLabel: label(ORDER_STATUS_LABELS, o.status),
    paymentStatus: o.payment_status,
    paymentStatusLabel: label(PAYMENT_STATUS_LABELS, o.payment_status),
    total: Number(o.total),
    parts: parts.filter((p) => p.order_id === o.id).sort(bySplit).map(toPart),
  }));
}

/**
 * El código del pedido completo, a partir del suyo o del de una de sus partes:
 * `mm-2026-001091-1` → `MM-2026-001091`. `null` si no tiene forma de código.
 */
export function orderCodeFrom(input: string): string | null {
  const match = /^(MM-\d{4}-\d+)(-\d+)?$/.exec(input.trim().toUpperCase());
  return match ? match[1] : null;
}

const ORDER_COLUMNS = 'id, code, created_at, status, payment_status, total';
const PART_COLUMNS = 'id, order_id, store_id, code, status, split_index, stores ( name )';

export const BUYER_ORDERS_MAX_PAGE_SIZE = 20;

export async function listBuyerOrders(
  service: SupabaseClient<any>,
  buyerId: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{ orders: BuyerOrderSummary[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(Math.max(1, Math.floor(opts.pageSize ?? 5)), BUYER_ORDERS_MAX_PAGE_SIZE);
  const from = (page - 1) * pageSize;

  const { data: orders, error, count } = await service
    .from('orders')
    .select(ORDER_COLUMNS, { count: 'exact' })
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);

  const ids = (orders ?? []).map((o: any) => o.id);
  const { data: parts, error: partsError } = ids.length
    ? await service.from('store_orders').select(PART_COLUMNS).in('order_id', ids)
    : { data: [], error: null };
  if (partsError) throw new Error(`No se pudieron leer las partes del pedido: ${partsError.message}`);

  return {
    orders: toOrderSummaries((orders ?? []) as OrderRow[], (parts ?? []) as unknown as PartRow[]),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export interface BuyerOrderDetail extends BuyerOrderSummary {
  subtotal: number;
  deliveryFee: number;
  serviceCommission: number;
  messagesAmount: number;
  platformCommission: number;
  discount: number;
  creditApplied: number;
  deliveryAddress: { municipality: string | null; neighborhood: string | null; addressLine: string | null } | null;
  parts: (BuyerOrderPart & {
    products: { name: string; quantity: number; unit: string | null; unitPrice: number; total: number }[];
    history: { status: string; statusLabel: string | null; at: string }[];
    delivery: {
      statusLabel: string;
      driverName: string | null;
      vehiclePlates: string | null;
      trackingLink: string | null;
      updatedAt: string;
    } | null;
  })[];
}

/** Lo del domicilio que se le pide a la base: sin códigos y sin `raw`. */
const BOOKING_COLUMNS =
  'booking_id, order_id, store_order_id, status_cd, package_status_cd, driver_name, vehicle_plates, tracking_link, is_active, updated_at';

export interface DetailRows {
  order: OrderRow & {
    subtotal: number;
    delivery_fee: number;
    service_commission_amount: number;
    messages_amount: number;
    platform_commission_amount: number;
    discount: number;
    credit_applied: number;
    delivery_address_snapshot: Record<string, any> | null;
  };
  parts: PartRow[];
  items: { catalog_name: string; unit_name: string | null; quantity: number; unit_price: number; total_price: number; store_products: { store_id: string } | null }[];
  history: { store_order_id: string; status: string; created_at: string }[];
  bookings: Partial<PiboxBookingRow>[];
}

/**
 * Arma el detalle con lo que se leyó. Sin base, para probar que solo sale lo
 * que se puede mostrar: cada parte con los productos de su tienda, y del
 * domicilio el estado, el conductor y el seguimiento.
 */
export function toOrderDetail(rows: DetailRows): BuyerOrderDetail {
  const { order, items, history, bookings } = rows;
  const parts = [...rows.parts].sort(bySplit);
  const [summary] = toOrderSummaries([order], parts);
  const snapshot = order.delivery_address_snapshot;

  return {
    ...summary,
    subtotal: Number(order.subtotal),
    deliveryFee: Number(order.delivery_fee),
    serviceCommission: Number(order.service_commission_amount),
    messagesAmount: Number(order.messages_amount),
    platformCommission: Number(order.platform_commission_amount),
    discount: Number(order.discount),
    creditApplied: Number(order.credit_applied),
    deliveryAddress: snapshot
      ? {
          municipality: snapshot.municipality ?? null,
          neighborhood: snapshot.neighborhood ?? null,
          addressLine: snapshot.address_line ?? null,
        }
      : null,
    parts: parts.map((part) => {
      // La reserva es de la parte o, si el pedido sale consolidado con un solo
      // mensajero, del pedido completo: entonces vale para todas sus partes.
      const booking =
        bookings.find((b) => b.store_order_id === part.id) ?? bookings.find((b) => b.order_id === order.id);
      const view = booking
        ? toDeliveryView({ ...booking, validation_code: null, pickup_validation_code: null, raw: null } as PiboxBookingRow, 'buyer')
        : null;

      return {
        ...toPart(part),
        products: items
          .filter((i) => i.store_products?.store_id === part.store_id)
          .map((i) => ({
            name: i.catalog_name,
            quantity: Number(i.quantity),
            unit: i.unit_name ?? null,
            unitPrice: Number(i.unit_price),
            total: Number(i.total_price),
          })),
        history: history
          .filter((h) => h.store_order_id === part.id)
          .map((h) => ({ status: h.status, statusLabel: label(ORDER_STATUS_LABELS, h.status), at: h.created_at })),
        // El teléfono del conductor no se comparte por el chat.
        delivery: view
          ? {
              statusLabel: view.statusLabel,
              driverName: view.driver?.name ?? null,
              vehiclePlates: view.driver?.plates ?? null,
              trackingLink: view.trackingLink,
              updatedAt: view.updatedAt,
            }
          : null,
      };
    }),
  };
}

/**
 * Un pedido del comprador por su código, el del pedido o el de una de sus
 * partes. `null` si no existe o no es suyo: las dos cosas se responden igual.
 */
export async function getBuyerOrder(
  service: SupabaseClient<any>,
  buyerId: string,
  code: string
): Promise<BuyerOrderDetail | null> {
  const orderCode = orderCodeFrom(code);
  if (!orderCode) return null;

  const { data: order, error } = await service
    .from('orders')
    .select(
      `${ORDER_COLUMNS}, subtotal, delivery_fee, service_commission_amount, messages_amount,
       platform_commission_amount, discount, credit_applied, delivery_address_snapshot`
    )
    .eq('buyer_id', buyerId)
    .eq('code', orderCode)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  if (!order) return null;

  const [parts, items] = await Promise.all([
    service.from('store_orders').select(PART_COLUMNS).eq('order_id', order.id),
    service
      .from('order_items')
      .select('catalog_name, unit_name, quantity, unit_price, total_price, store_products ( store_id )')
      .eq('order_id', order.id),
  ]);
  for (const r of [parts, items]) {
    if (r.error) throw new Error(`No se pudo leer el pedido: ${r.error.message}`);
  }

  const partIds = (parts.data ?? []).map((p: any) => p.id);

  // Una reserva es del pedido completo (consolidado) o de una parte, nunca de
  // los dos (`pibox_bookings_un_dueno`): se buscan las dos.
  const bookings = await service
    .from('pibox_bookings')
    .select(BOOKING_COLUMNS)
    .eq('is_active', true)
    .or([`order_id.eq.${order.id}`, ...(partIds.length ? [`store_order_id.in.(${partIds.join(',')})`] : [])].join(','));
  if (bookings.error) throw new Error(`No se pudo leer el domicilio: ${bookings.error.message}`);
  const history = partIds.length
    ? await service
        .from('store_order_status_history')
        .select('store_order_id, status, created_at')
        .in('store_order_id', partIds)
        .order('created_at', { ascending: true })
    : { data: [], error: null };
  if (history.error) throw new Error(`No se pudo leer el historial: ${history.error.message}`);

  return toOrderDetail({
    order: order as unknown as DetailRows['order'],
    parts: (parts.data ?? []) as unknown as PartRow[],
    items: (items.data ?? []) as unknown as DetailRows['items'],
    history: (history.data ?? []) as DetailRows['history'],
    bookings: (bookings.data ?? []) as Partial<PiboxBookingRow>[],
  });
}
