import type { SupabaseClient } from '@supabase/supabase-js';
import { reasonsFor, type PqrsOpener } from './reasons';
import { whyReasonUnavailable } from './rules';
import { listRecentOrders, loadOrderContext } from './order-context';
import { loadPqrsSettings } from './settings';
import { PqrsInputError } from './errors';
import type { PqrsActor } from './actor';
import type { PqrsFormContext } from './types';

/**
 * Lo que el formulario necesita para pintarse: los pedidos entre los que se
 * puede elegir, los productos del elegido y qué motivos le aplican.
 *
 * Que un motivo no aplique lo decide `whyReasonUnavailable`, la misma función
 * que valida la radicación: el formulario nunca ofrece algo que el servidor
 * después rechace.
 */
export async function loadFormContext(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  params: {
    as: PqrsOpener;
    storeOrderId?: string | null;
    /** `orders.id`: «Mis Órdenes» no conoce el id del pedido de la tienda. */
    orderId?: string | null;
    storeId?: string | null;
  }
): Promise<PqrsFormContext> {
  const esTienda = params.as === 'seller';

  const tiendas = esTienda
    ? params.storeId
      ? actor.storeIds.filter((id) => id === params.storeId)
      : actor.storeIds
    : [];

  if (esTienda && tiendas.length === 0) {
    throw new PqrsInputError('Solo el equipo de una tienda puede radicar estos casos.', 403);
  }

  // Cada pedido es de una sola tienda, así que el de la compra identifica al de
  // la tienda.
  let storeOrderId = params.storeOrderId ?? null;
  if (!storeOrderId && params.orderId) {
    const { data } = await service
      .from('store_orders')
      .select('id')
      .eq('order_id', params.orderId)
      .order('split_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    storeOrderId = data?.id ?? null;
  }
  const pidePedido = Boolean(params.storeOrderId || params.orderId);

  const [settings, orders, pedido] = await Promise.all([
    loadPqrsSettings(service),
    listRecentOrders(service, esTienda ? { storeIds: tiendas } : { buyerId: actor.userId }),
    storeOrderId ? loadOrderContext(service, storeOrderId) : Promise.resolve(null),
  ]);

  // Mismo criterio que al radicar: un pedido ajeno es un pedido que no existe.
  const esSuyo =
    pedido && (esTienda ? actor.storeIds.includes(pedido.storeId) : pedido.buyerId === actor.userId);
  if (pidePedido && !esSuyo) throw new PqrsInputError('No encontramos ese pedido.', 404);

  const order = pedido
    ? (({ orderId: _o, buyerId: _b, ...resto }) => resto)(pedido)
    : null;

  return {
    orders,
    order,
    claimWindowHours: settings.claimWindowHours,
    reasons: reasonsFor(params.as).map((r) => ({
      key: r.key,
      label: r.label,
      help: r.help,
      kind: r.kind,
      order: r.order,
      items: r.items,
      photo: r.photo,
      // Sin pedido elegido no se marca nada como no disponible: el formulario
      // pedirá el pedido cuando el motivo lo exija.
      unavailableWhy: order ? whyReasonUnavailable(r, order, settings.claimWindowHours) : null,
    })),
  };
}
