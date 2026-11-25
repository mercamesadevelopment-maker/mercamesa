import type { SupabaseClient } from '@supabase/supabase-js';
import { toDeliveryView, type DeliveryView } from '@/lib/pibox/delivery-view';
import type { Database } from '@/types/database_generated';

type OrderStatus = Database['public']['Enums']['order_status'];
type DetailRow = Database['public']['Views']['orders_detail_view']['Row'];

/**
 * Los pedidos que el comprador tiene en curso, para mostrárselos sin que tenga
 * que buscarlos: arriba de la página de inicio y en la burbuja que lo acompaña
 * por la app (`features/orders/active-orders-context.tsx`).
 *
 * Cada uno es una fila de `orders_detail_view` (una por tienda), la misma que
 * abre el detalle del pedido, con su domicilio de Pibox como lo ve el comprador.
 */

/** Cuánto sigue a la vista un pedido entregado: lo justo para que vea «fue entregado». */
export const DELIVERED_VISIBLE_MS = 3 * 60 * 60 * 1000;

/** Hasta dónde se mira atrás: un pedido en curso de hace más ya no es «en curso». */
const LOOKBACK_DAYS = 14;

const EN_CURSO: OrderStatus[] = ['paid', 'confirmed', 'packing', 'at_collection', 'dispatched'];

/** Qué tan adelantado va, para ordenar: lo más cerca de llegar, primero. */
const AVANCE: Partial<Record<OrderStatus, number>> = {
  dispatched: 5,
  at_collection: 4,
  packing: 3,
  confirmed: 2,
  paid: 2,
  delivered: 1,
};

export interface ActiveCandidate {
  status: OrderStatus | null;
  created_at: string | null;
  payable_until: string | null;
  /** Cuándo se entregó la parte, si se entregó. */
  deliveredAt: string | null;
}

/**
 * Cuáles cuentan como «en curso» y en qué orden:
 * - primero lo que pide algo del comprador (falta pagar y todavía se puede);
 * - después lo más adelantado;
 * - a igual avance, lo más nuevo.
 */
export function pickActiveParts<T extends ActiveCandidate>(rows: T[], now: Date): T[] {
  const ahora = now.getTime();
  const vale = (r: T) => {
    if (r.status && EN_CURSO.includes(r.status)) return true;
    if (r.status === 'pending') return Boolean(r.payable_until && new Date(r.payable_until).getTime() > ahora);
    if (r.status === 'delivered') {
      return Boolean(r.deliveredAt && ahora - new Date(r.deliveredAt).getTime() <= DELIVERED_VISIBLE_MS);
    }
    return false;
  };
  const peso = (r: T) => (r.status === 'pending' ? 10 : AVANCE[r.status as OrderStatus] ?? 0);
  return rows
    .filter(vale)
    .sort((a, b) => peso(b) - peso(a) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

export interface ActiveBuyerOrder {
  order: DetailRow;
  delivery: DeliveryView | null;
}

export async function loadActiveBuyerOrders(service: SupabaseClient<any>, buyerId: string): Promise<ActiveBuyerOrder[]> {
  const desde = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Siempre filtrado por el comprador: se lee con el cliente de servicio, como
  // `GET /api/orders/my-orders` (con la RLS de tiendas y productos, una tienda
  // desactivada haría desaparecer el pedido).
  const { data: filas, error } = await service
    .from('orders_detail_view')
    .select('*')
    .eq('buyer_id', buyerId)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const detalle = (filas ?? []) as DetailRow[];
  if (detalle.length === 0) return [];

  const orderIds = [...new Set(detalle.map((d) => d.order_id).filter((id): id is string => !!id))];
  const { data: partes, error: partesError } = await service
    .from('store_orders')
    .select('id, order_id, store_id, status, orders!inner ( fulfillment )')
    .in('order_id', orderIds);
  if (partesError) throw new Error(partesError.message);

  const parteDe = new Map((partes ?? []).map((p: any) => [`${p.order_id}:${p.store_id}`, p]));
  const entregadas = (partes ?? []).filter((p: any) => p.status === 'delivered').map((p: any) => p.id);
  const entregadaEn = new Map<string, string>();
  if (entregadas.length) {
    const { data: hist } = await service
      .from('store_order_status_history')
      .select('store_order_id, created_at')
      .in('store_order_id', entregadas)
      .eq('status', 'delivered');
    for (const h of hist ?? []) {
      const previo = entregadaEn.get(h.store_order_id);
      if (!previo || h.created_at > previo) entregadaEn.set(h.store_order_id, h.created_at);
    }
  }

  const candidatos = detalle.map((d) => {
    const parte = parteDe.get(`${d.order_id}:${d.store_id}`);
    return { ...d, parte, deliveredAt: parte ? entregadaEn.get(parte.id) ?? null : null };
  });
  const elegidos = pickActiveParts(candidatos, new Date());
  if (elegidos.length === 0) return [];

  // El domicilio: el de la parte, o el del pedido entero si es de varias tiendas.
  const porParte = elegidos.filter((e) => e.parte && e.parte.orders?.fulfillment !== 'consolidated').map((e) => e.parte.id);
  const porPedido = elegidos.filter((e) => e.parte?.orders?.fulfillment === 'consolidated').map((e) => e.order_id as string);
  const [r1, r2] = await Promise.all([
    porParte.length
      ? service.from('pibox_bookings').select('*').in('store_order_id', porParte).order('created_at', { ascending: false })
      : { data: [] },
    porPedido.length
      ? service.from('pibox_bookings').select('*').in('order_id', porPedido).order('created_at', { ascending: false })
      : { data: [] },
  ]);
  // La vigente, o si no hay, la más reciente: como `GET /api/pibox/bookings`.
  const reserva = new Map<string, any>();
  for (const b of [...(r1.data ?? []), ...(r2.data ?? [])] as any[]) {
    const clave = b.order_id ?? b.store_order_id;
    const actual = reserva.get(clave);
    if (!actual || (!actual.is_active && b.is_active)) reserva.set(clave, b);
  }

  return elegidos.map(({ parte, deliveredAt: _d, ...order }) => {
    const clave = parte?.orders?.fulfillment === 'consolidated' ? order.order_id : parte?.id;
    const fila = clave ? reserva.get(clave) : null;
    return { order: order as DetailRow, delivery: fila ? toDeliveryView(fila, 'buyer') : null };
  });
}
