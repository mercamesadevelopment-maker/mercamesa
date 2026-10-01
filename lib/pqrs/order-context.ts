import type { SupabaseClient } from '@supabase/supabase-js';
import type { PqrsOrderContext, PqrsOrderOption } from './types';

/**
 * El pedido del que habla una PQRS, con lo que las reglas necesitan saber de él.
 *
 * Cada pedido es de una sola tienda (el carrito crea uno por tienda), así que
 * los productos del pedido son los de esa tienda.
 */

const SELECT_PEDIDO = `
  id, code, store_id, status, created_at, order_id,
  stores ( name ),
  orders!inner ( id, buyer_id, payment_status, profiles ( full_name ) )
`;

function aOpcion(so: any): PqrsOrderOption & { buyerId: string | null; orderId: string; paid: boolean } {
  return {
    storeOrderId: so.id,
    code: so.code,
    storeId: so.store_id,
    storeName: so.stores?.name ?? 'Tienda',
    status: so.status,
    createdAt: so.created_at,
    buyerName: so.orders?.profiles?.full_name ?? null,
    buyerId: so.orders?.buyer_id ?? null,
    orderId: so.order_id,
    paid: so.orders?.payment_status === 'approved',
  };
}

/** Los pedidos recientes entre los que elige quien radica. */
export async function listRecentOrders(
  service: SupabaseClient<any>,
  filtro: { buyerId: string } | { storeIds: string[] }
): Promise<PqrsOrderOption[]> {
  let query = service
    .from('store_orders')
    .select(SELECT_PEDIDO)
    .order('created_at', { ascending: false })
    .limit(30);

  if ('buyerId' in filtro) {
    query = query.eq('orders.buyer_id', filtro.buyerId);
  } else {
    if (filtro.storeIds.length === 0) return [];
    // Solo pedidos de compradores registrados: una venta de mostrador no tiene
    // a quién reclamarle ni contra quién.
    query = query.in('store_id', filtro.storeIds).not('orders.buyer_id', 'is', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);

  return (data ?? []).map((so) => {
    const { buyerId: _b, orderId: _o, paid: _p, ...opcion } = aOpcion(so);
    return opcion;
  });
}

export interface LoadedOrderContext extends PqrsOrderContext {
  orderId: string;
  buyerId: string | null;
}

export async function loadOrderContext(
  service: SupabaseClient<any>,
  storeOrderId: string
): Promise<LoadedOrderContext | null> {
  const { data: so, error } = await service
    .from('store_orders')
    .select(SELECT_PEDIDO)
    .eq('id', storeOrderId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el pedido: ${error.message}`);
  if (!so) return null;

  const base = aOpcion(so);

  const [{ data: items }, { data: entrega }] = await Promise.all([
    service
      .from('order_items')
      .select('id, catalog_name, unit_name, quantity, unit_price')
      .eq('order_id', base.orderId)
      .order('created_at', { ascending: true }),
    // `store_orders.updated_at` se mueve con cualquier cambio; la fecha real de
    // la entrega es la del registro del cambio de estado (lo mismo que usa la
    // dispersión para su periodo de espera).
    service
      .from('store_order_status_history')
      .select('created_at')
      .eq('store_order_id', storeOrderId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    ...base,
    deliveredAt: base.status === 'delivered' ? entrega?.created_at ?? null : null,
    items: (items ?? []).map((i: any) => ({
      id: i.id,
      name: i.catalog_name,
      unit: i.unit_name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    })),
  };
}
