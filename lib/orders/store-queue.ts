import type { SupabaseClient } from '@supabase/supabase-js';
import { toDeliveryView } from '@/lib/pibox/delivery-view';
import type { PiboxBookingRow } from '@/lib/pibox/types';
import { STORE_STATUS_LABELS } from './status-labels';
import { NEXT_STATUS, type AdvanceableStatus } from './status-transitions';

/**
 * Los pedidos de una tienda para el chat del tendero (`pedidos_del_tendero`):
 * las partes que le tocan, lo más urgente primero.
 *
 * Como en su panel, solo los pedidos con el pago aprobado: uno sin pagar no es
 * trabajo del tendero todavía. Del comprador sale el primer nombre y el barrio,
 * que es lo que necesita para empacar; nada de teléfono, correo, documento ni
 * dirección completa. Los códigos de Pibox no salen: le llegan por aviso.
 */

export const OPEN_STATUSES = ['pending', 'confirmed', 'paid', 'packing', 'at_collection', 'dispatched'] as const;

/** Qué tan urgente es una parte: primero lo que hay que preparar, al final lo cerrado. */
const URGENCIA: Record<string, number> = {
  pending: 0,
  confirmed: 0,
  paid: 0,
  packing: 1,
  at_collection: 2,
  dispatched: 3,
  delivered: 4,
  returned: 5,
  cancelled: 5,
};

export interface StoreQueueRow {
  id: string;
  order_id: string;
  code: string;
  status: string;
  created_at: string;
  subtotal: number;
  notes: string | null;
  packing_notes: string | null;
  has_refrigerated: boolean | null;
  orders: {
    code: string;
    fulfillment: string | null;
    client_id?: string | null;
    delivery_address_snapshot: Record<string, any> | null;
    profiles: { full_name: string | null } | null;
  } | null;
}

export interface StoreQueueItem {
  order_id: string;
  catalog_name: string;
  unit_name: string | null;
  quantity: number;
  total_price: number;
}

export interface StoreQueuePart {
  code: string;
  orderCode: string;
  status: string;
  statusLabel: string;
  /** El paso siguiente y cómo se llama en el panel, o `null` si ya no avanza. */
  next: { status: string; label: string } | null;
  createdAt: string;
  buyerFirstName: string | null;
  neighborhood: string | null;
  multiStore: boolean;
  /** Venta en el local (mostrador): no hay domicilio ni comprador de la app. */
  inStore: boolean;
  refrigerated: boolean;
  buyerNotes: string | null;
  packingNotes: string | null;
  subtotal: number;
  products: { name: string; quantity: number; unit: string | null; total: number }[];
  delivery: { statusLabel: string; driverName: string | null; vehiclePlates: string | null } | null;
}

const primerNombre = (nombre: string | null | undefined) => (nombre ?? '').trim().split(/\s+/)[0] || null;

/** Arma la cola con lo leído, lo más urgente primero. Sin base. */
export function toStoreQueue(
  parts: StoreQueueRow[],
  items: StoreQueueItem[],
  bookings: Partial<PiboxBookingRow>[]
): StoreQueuePart[] {
  return parts
    .slice()
    .sort((a, b) => (URGENCIA[a.status] ?? 9) - (URGENCIA[b.status] ?? 9) || a.created_at.localeCompare(b.created_at))
    .map((p) => {
      const siguiente = NEXT_STATUS[p.status as AdvanceableStatus];
      const booking = bookings.find((b) => b.store_order_id === p.id) ?? bookings.find((b) => b.order_id === p.order_id);
      const vista = booking
        ? toDeliveryView({ ...booking, validation_code: null, pickup_validation_code: null, raw: null } as PiboxBookingRow, 'store')
        : null;
      return {
        code: p.code,
        orderCode: p.orders?.code ?? '',
        status: p.status,
        statusLabel: STORE_STATUS_LABELS[p.status as keyof typeof STORE_STATUS_LABELS] ?? p.status,
        next: siguiente ? { status: siguiente, label: STORE_STATUS_LABELS[siguiente] } : null,
        createdAt: p.created_at,
        buyerFirstName: primerNombre(p.orders?.profiles?.full_name),
        neighborhood: p.orders?.delivery_address_snapshot?.neighborhood ?? null,
        multiStore: p.orders?.fulfillment === 'consolidated',
        inStore: Boolean(p.orders?.client_id),
        refrigerated: Boolean(p.has_refrigerated),
        buyerNotes: p.notes,
        packingNotes: p.packing_notes,
        subtotal: Number(p.subtotal),
        products: items
          .filter((i) => i.order_id === p.order_id)
          .map((i) => ({ name: i.catalog_name, quantity: Number(i.quantity), unit: i.unit_name, total: Number(i.total_price) })),
        // Sin el teléfono del conductor, como en el chat del comprador.
        delivery: vista
          ? { statusLabel: vista.statusLabel, driverName: vista.driver?.name ?? null, vehiclePlates: vista.driver?.plates ?? null }
          : null,
      };
    });
}

export const STORE_QUEUE_MAX = 30;

/** Las partes de la tienda: las abiertas o, con `includeClosed`, también las de los últimos días. */
export async function loadStoreQueue(
  service: SupabaseClient<any>,
  storeId: string,
  opts: { includeClosed?: boolean; limit?: number } = {}
): Promise<{ parts: StoreQueuePart[]; truncated: boolean }> {
  const limite = Math.min(opts.limit ?? STORE_QUEUE_MAX, STORE_QUEUE_MAX);
  let query = service
    .from('store_orders')
    .select(
      `id, order_id, code, status, created_at, subtotal, notes, packing_notes, has_refrigerated,
       orders!inner ( code, fulfillment, client_id, payment_status, delivery_address_snapshot, profiles ( full_name ) )`
    )
    .eq('store_id', storeId)
    .eq('orders.payment_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limite + 1);
  if (!opts.includeClosed) query = query.in('status', [...OPEN_STATUSES]);
  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);

  const filas = (data ?? []) as unknown as StoreQueueRow[];
  const partes = filas.slice(0, limite);
  if (partes.length === 0) return { parts: [], truncated: false };

  const orderIds = Array.from(new Set(partes.map((p) => p.order_id)));
  const partIds = partes.map((p) => p.id);
  const [items, bookings] = await Promise.all([
    service
      .from('order_items')
      .select('order_id, catalog_name, unit_name, quantity, total_price, store_products!inner ( store_id )')
      .in('order_id', orderIds)
      .eq('store_products.store_id', storeId),
    service
      .from('pibox_bookings')
      .select('booking_id, order_id, store_order_id, status_cd, package_status_cd, driver_name, vehicle_plates, is_active, updated_at')
      .eq('is_active', true)
      .or(`store_order_id.in.(${partIds.join(',')}),order_id.in.(${orderIds.join(',')})`),
  ]);
  if (items.error) throw new Error(`No se pudieron leer los productos: ${items.error.message}`);
  if (bookings.error) throw new Error(`No se pudo leer el domicilio: ${bookings.error.message}`);

  return {
    parts: toStoreQueue(partes, (items.data ?? []) as unknown as StoreQueueItem[], (bookings.data ?? []) as Partial<PiboxBookingRow>[]),
    truncated: filas.length > limite,
  };
}
