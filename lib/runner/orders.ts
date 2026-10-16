import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activeOrderBooking,
  CONSOLIDATED_ORDER_SELECT,
  requestCourierIfReady,
  toConsolidatedOrder,
  type ConsolidatedOrder,
} from '@/lib/orders/consolidated-order';
import { activeParts, receiverOf, runnerCommission } from '@/lib/orders/consolidation';
import { canWorkMarketplace, StaffError, type StaffActor } from '@/lib/marketplace-staff/actor';

/**
 * Los pedidos que arma el patinador: los de varias tiendas de una plaza con
 * patinador (`orders.runner_required`).
 *
 *   tienda: «Listo Recogida»  →  patinador: «Recogido» en cada tienda
 *                             →  patinador: «Entregado en bahía»
 *                             →  logística lo recibe, o se pide el mensajero
 *
 * Todo acá espera el cliente de servicio; quien llama ya cargó al actor
 * (`loadStaffActor`) y cada función comprueba que el pedido sea de su plaza.
 */

/** Estados en los que el pedido ya salió de la plaza. */
const DESPACHADO = ['dispatched', 'delivered'];

export interface RunnerPart {
  storeOrderId: string;
  code: string;
  storeName: string;
  /** «Local 234, pasillo 3»: dónde encontrar la tienda en la plaza. */
  localAddress: string | null;
  /** Cómo la empacó el tendero: cuántas bolsas, dónde van los fríos. */
  packingNotes: string | null;
  status: string;
  collectedAt: string | null;
  /** La tienda ya la tiene lista y falta recogerla. */
  canCollect: boolean;
  items: { name: string; quantity: number; unit: string; notes: string | null }[];
}

export interface RunnerOrder {
  orderId: string;
  code: string;
  createdAt: string;
  marketplaceName: string | null;
  buyerName: string | null;
  bayReadyAt: string | null;
  /** A quién se entrega en la bahía: a logística o directo al domiciliario. */
  receiver: 'logistics' | 'courier';
  /** En qué va el pedido, visto por el patinador. */
  stage: 'preparing' | 'collecting' | 'ready_for_bay' | 'at_bay' | 'dispatched' | 'closed';
  /** Se puede marcar «Entregado en bahía» (o reintentar pedir el mensajero). */
  canMarkAtBay: boolean;
  /** La comisión de este pedido, si la plaza la configuró. Informativa. */
  commissionAmount: number | null;
  parts: RunnerPart[];
  booking: {
    simulated: boolean;
    driverName: string | null;
    driverPhone: string | null;
    vehiclePlates: string | null;
    trackingLink: string | null;
    pickupValidationCode: string | null;
  } | null;
}

const SELECT_PEDIDO = `${CONSOLIDATED_ORDER_SELECT},
  order_items ( catalog_name, unit_name, quantity, notes, store_products ( store_id ) )
`;

function aPedido(o: any, reserva: any | null): RunnerOrder {
  const pedido: ConsolidatedOrder = toConsolidatedOrder(o);
  const activas = activeParts(pedido.parts);
  const receiver = receiverOf(pedido.config);

  const parts: RunnerPart[] = pedido.parts.map((p) => ({
    storeOrderId: p.id,
    code: p.code,
    storeName: p.storeName,
    localAddress: p.localAddress,
    packingNotes: p.packingNotes,
    status: p.status,
    collectedAt: p.collectedAt,
    canCollect: p.status === 'at_collection' && !p.collectedAt && !pedido.bayReadyAt,
    items: (o.order_items ?? [])
      .filter((i: any) => i.store_products?.store_id === p.storeId)
      .map((i: any) => ({
        name: i.catalog_name,
        quantity: Number(i.quantity),
        unit: i.unit_name,
        notes: i.notes ?? null,
      })),
  }));

  const todasRecogidas =
    activas.length > 0 && activas.every((p) => p.status === 'at_collection' && p.collectedAt);

  let stage: RunnerOrder['stage'];
  if (activas.length === 0 || activas.every((p) => p.status === 'delivered')) stage = 'closed';
  else if (activas.some((p) => DESPACHADO.includes(p.status))) stage = 'dispatched';
  else if (pedido.bayReadyAt) stage = 'at_bay';
  else if (todasRecogidas) stage = 'ready_for_bay';
  else if (activas.some((p) => p.status === 'at_collection')) stage = 'collecting';
  else stage = 'preparing';

  return {
    orderId: pedido.id,
    code: pedido.code,
    createdAt: pedido.createdAt,
    marketplaceName: pedido.marketplaceName,
    buyerName: pedido.buyerName,
    bayReadyAt: pedido.bayReadyAt,
    receiver,
    stage,
    // La primera vez, con todo recogido. Después, solo para reintentar pedir el
    // mensajero cuando no hay logística y la solicitud falló.
    canMarkAtBay: todasRecogidas && (!pedido.bayReadyAt || (receiver === 'courier' && !reserva)),
    commissionAmount: pedido.commission.amount,
    parts,
    booking: reserva
      ? {
          simulated: String(reserva.booking_id).startsWith('SIMULADO-'),
          driverName: reserva.driver_name ?? null,
          driverPhone: reserva.driver_phone ?? null,
          vehiclePlates: reserva.vehicle_plates ?? null,
          trackingLink: reserva.tracking_link ?? null,
          pickupValidationCode: reserva.pickup_validation_code ?? null,
        }
      : null,
  };
}

async function reservasVigentes(service: SupabaseClient<any>, orderIds: string[]): Promise<Map<string, any>> {
  if (orderIds.length === 0) return new Map();

  const { data } = await service
    .from('pibox_bookings')
    .select('order_id, booking_id, driver_name, driver_phone, vehicle_plates, tracking_link, pickup_validation_code')
    .in('order_id', orderIds)
    .eq('is_active', true);

  return new Map((data ?? []).map((r: any) => [r.order_id, r]));
}

function marketplaceDe(o: any): string | null {
  return o.store_orders?.[0]?.stores?.marketplace_id ?? null;
}

/**
 * Los pedidos con patinador de las plazas de quien pregunta.
 *
 * `open` son los que todavía tienen algo por hacer en la plaza; `closed`, los
 * últimos que ya salieron, para poder consultar qué se despachó.
 */
export async function listRunnerOrders(
  service: SupabaseClient<any>,
  actor: StaffActor,
  scope: 'open' | 'closed'
): Promise<RunnerOrder[]> {
  if (!actor.isAdmin && actor.marketplaceIds.length === 0) return [];

  const { data, error } = await service
    .from('orders')
    .select(SELECT_PEDIDO)
    .eq('fulfillment', 'consolidated')
    .eq('runner_required', true)
    .eq('payment_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);

  const propios = (data ?? []).filter((o: any) => canWorkMarketplace(actor, marketplaceDe(o)));
  const reservas = await reservasVigentes(service, propios.map((o: any) => o.id));

  const pedidos = propios.map((o: any) => aPedido(o, reservas.get(o.id) ?? null));
  const cerrados = (p: RunnerOrder) => p.stage === 'closed' || p.stage === 'dispatched';

  return scope === 'open'
    ? // Lo más viejo primero: es lo que más lleva esperando.
      pedidos.filter((p) => !cerrados(p)).reverse()
    : pedidos.filter(cerrados).slice(0, 30);
}

async function cargarPedido(service: SupabaseClient<any>, actor: StaffActor, orderId: string): Promise<any> {
  const { data: o, error } = await service.from('orders').select(SELECT_PEDIDO).eq('id', orderId).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el pedido: ${error.message}`);

  // Un pedido de otra plaza responde igual que uno que no existe.
  if (
    !o ||
    o.fulfillment !== 'consolidated' ||
    !o.runner_required ||
    !canWorkMarketplace(actor, marketplaceDe(o))
  ) {
    throw new StaffError('No encontramos ese pedido.', 404);
  }
  if (o.payment_status !== 'approved') {
    throw new StaffError('Este pedido todavía no está pagado.', 409);
  }
  return o;
}

export async function getRunnerOrder(
  service: SupabaseClient<any>,
  actor: StaffActor,
  orderId: string
): Promise<RunnerOrder> {
  const o = await cargarPedido(service, actor, orderId);
  const reservas = await reservasVigentes(service, [orderId]);
  return aPedido(o, reservas.get(orderId) ?? null);
}

/** El patinador recogió en el local la parte de una tienda. */
export async function collectPart(
  service: SupabaseClient<any>,
  actor: StaffActor,
  storeOrderId: string
): Promise<RunnerOrder> {
  const { data: parte } = await service
    .from('store_orders')
    .select('id, order_id, status, collected_at, stores ( name )')
    .eq('id', storeOrderId)
    .maybeSingle();

  if (!parte) throw new StaffError('No encontramos ese pedido.', 404);

  // Comprueba plaza, pago y que sea un pedido con patinador.
  const o = await cargarPedido(service, actor, parte.order_id);

  // Marcarla dos veces no es un error: el patinador puede tocar el botón con
  // mala señal y repetir.
  if (!parte.collected_at) {
    if (o.bay_ready_at) {
      throw new StaffError('Este pedido ya está en la bahía.', 409);
    }
    if (parte.status !== 'at_collection') {
      throw new StaffError(`${(parte as any).stores?.name ?? 'La tienda'} todavía no tiene lista su parte.`, 409);
    }

    const { error } = await service
      .from('store_orders')
      .update({ collected_at: new Date().toISOString(), collected_by: actor.userId })
      .eq('id', storeOrderId)
      .is('collected_at', null);
    if (error) throw new Error(`No se pudo registrar la recogida: ${error.message}`);

    // El estado no cambia —sigue en «Listo Recogida» hasta que el mensajero se
    // la lleve—, pero queda en el histórico quién la recogió.
    await service.from('store_order_status_history').insert({
      store_order_id: storeOrderId,
      status: 'at_collection',
      notes: 'Recogido por el patinador para llevar a la bahía',
      changed_by: actor.userId,
    });
  }

  return getRunnerOrder(service, actor, parte.order_id);
}

export interface BayOutcome {
  order: RunnerOrder;
  /** Mensaje para el patinador cuando no se pudo pedir el mensajero. */
  deliveryError: string | null;
}

/**
 * El patinador dejó todo el pedido en la bahía.
 *
 * Queda registrado quién y cuándo, y con eso la comisión. Si la plaza tiene
 * logística, ella recibe y pide el mensajero; si no, se pide acá. Pedirlo dos
 * veces no manda dos mensajeros, y si Pibox falla el pedido queda en la bahía
 * igual —es donde está— y se puede reintentar.
 */
export async function markAtBay(
  service: SupabaseClient<any>,
  actor: StaffActor,
  orderId: string
): Promise<BayOutcome> {
  const o = await cargarPedido(service, actor, orderId);
  const pedido = toConsolidatedOrder(o);
  const activas = activeParts(pedido.parts);

  if (activas.length === 0) {
    throw new StaffError('Todas las tiendas cancelaron su parte: no hay nada que despachar.', 409);
  }

  const pendientes = activas.filter((p) => p.status !== 'at_collection' || !p.collectedAt);
  if (pendientes.length > 0) {
    throw new StaffError(`Falta recoger en: ${pendientes.map((p) => p.storeName).join(', ')}.`, 409);
  }

  if (!pedido.bayReadyAt) {
    const productos = activas.reduce((suma, p) => suma + p.subtotal, 0);
    await service
      .from('orders')
      .update({
        bay_ready_at: new Date().toISOString(),
        bay_ready_by: actor.userId,
        runner_commission_amount: runnerCommission(pedido.commission.type, pedido.commission.value, productos),
      })
      .eq('id', orderId)
      .is('bay_ready_at', null);

    await service.from('store_order_status_history').insert(
      activas.map((p) => ({
        store_order_id: p.id,
        status: p.status,
        notes:
          receiverOf(pedido.config) === 'logistics'
            ? 'El patinador entregó el pedido en la bahía, a logística'
            : 'El patinador dejó el pedido en la bahía, listo para el domiciliario',
        changed_by: actor.userId,
      }))
    );
  }

  let deliveryError: string | null = null;
  if (receiverOf(pedido.config) === 'courier' && !(await activeOrderBooking(service, orderId))) {
    const { data: patinador } = await service.from('profiles').select('phone').eq('id', actor.userId).maybeSingle();
    deliveryError = (await requestCourierIfReady(service, orderId, patinador?.phone ?? null, actor.userId)).error;
  }

  return { order: await getRunnerOrder(service, actor, orderId), deliveryError };
}
