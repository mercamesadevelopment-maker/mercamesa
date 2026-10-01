import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildBookingPayload,
  createBooking,
  isPiboxEnabled,
  loadOrderBookingContext,
  PiboxDataError,
} from '@/lib/pibox';
import { persistBookingSnapshot } from '@/lib/pibox/services/sync.service';
import { canWorkMarketplace, RunnerError, type RunnerActor } from './actor';

/**
 * Los pedidos que arma el patinador: los de varias tiendas.
 *
 *   tienda: «Listo Recogida»  →  patinador: «Recogido» en cada tienda
 *                             →  patinador: «En bahía»  →  se pide el mensajero
 *
 * Todo acá espera el cliente de servicio; quien llama ya cargó al actor
 * (`loadRunnerActor`) y cada función comprueba que el pedido sea de su plaza.
 */

/** Estados en los que una parte ya no viaja con el pedido. */
const FUERA = ['cancelled', 'returned'];
/** Estados en los que el pedido ya salió de la plaza. */
const DESPACHADO = ['dispatched', 'delivered'];

export interface RunnerPart {
  storeOrderId: string;
  code: string;
  storeName: string;
  /** «Local 234, pasillo 3»: dónde encontrar la tienda en la plaza. */
  localAddress: string | null;
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
  /** En qué va el pedido, visto por el patinador. */
  stage: 'preparing' | 'collecting' | 'ready_for_bay' | 'at_bay' | 'dispatched' | 'closed';
  /** Se puede marcar «En bahía» (o volver a pedir el mensajero si falló). */
  canMarkAtBay: boolean;
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

const SELECT_PEDIDO = `
  id, code, created_at, bay_ready_at, fulfillment, payment_status,
  profiles ( full_name ),
  store_orders (
    id, code, status, collected_at, store_id, split_index,
    stores ( name, local_address, marketplace_id, marketplaces ( name ) )
  ),
  order_items ( catalog_name, unit_name, quantity, notes, store_products ( store_id ) )
`;

function aPedido(o: any, reserva: any | null): RunnerOrder {
  const partes = [...(o.store_orders ?? [])].sort((a, b) => a.split_index - b.split_index);
  const activas = partes.filter((p) => !FUERA.includes(p.status));

  const parts: RunnerPart[] = partes.map((p) => ({
    storeOrderId: p.id,
    code: p.code,
    storeName: p.stores?.name ?? 'Tienda',
    localAddress: p.stores?.local_address ?? null,
    status: p.status,
    collectedAt: p.collected_at ?? null,
    canCollect: p.status === 'at_collection' && !p.collected_at && !o.bay_ready_at,
    items: (o.order_items ?? [])
      .filter((i: any) => i.store_products?.store_id === p.store_id)
      .map((i: any) => ({
        name: i.catalog_name,
        quantity: Number(i.quantity),
        unit: i.unit_name,
        notes: i.notes ?? null,
      })),
  }));

  const todasRecogidas =
    activas.length > 0 && activas.every((p) => p.status === 'at_collection' && p.collected_at);

  let stage: RunnerOrder['stage'];
  if (activas.length === 0 || activas.every((p) => p.status === 'delivered')) stage = 'closed';
  else if (activas.some((p) => DESPACHADO.includes(p.status))) stage = 'dispatched';
  else if (o.bay_ready_at && reserva) stage = 'at_bay';
  else if (todasRecogidas) stage = 'ready_for_bay';
  else if (activas.some((p) => p.status === 'at_collection')) stage = 'collecting';
  else stage = 'preparing';

  return {
    orderId: o.id,
    code: o.code,
    createdAt: o.created_at,
    marketplaceName: partes[0]?.stores?.marketplaces?.name ?? null,
    buyerName: o.profiles?.full_name ?? null,
    bayReadyAt: o.bay_ready_at ?? null,
    stage,
    // Con todo recogido y sin mensajero vigente: sea la primera vez o un
    // reintento porque la solicitud falló.
    canMarkAtBay: todasRecogidas && !reserva,
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
  actor: RunnerActor,
  scope: 'open' | 'closed'
): Promise<RunnerOrder[]> {
  if (!actor.isAdmin && actor.marketplaceIds.length === 0) return [];

  const { data, error } = await service
    .from('orders')
    .select(SELECT_PEDIDO)
    .eq('fulfillment', 'runner')
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

async function cargarPedido(service: SupabaseClient<any>, actor: RunnerActor, orderId: string): Promise<any> {
  const { data: o, error } = await service.from('orders').select(SELECT_PEDIDO).eq('id', orderId).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el pedido: ${error.message}`);

  // Un pedido de otra plaza responde igual que uno que no existe.
  if (!o || o.fulfillment !== 'runner' || !canWorkMarketplace(actor, marketplaceDe(o))) {
    throw new RunnerError('No encontramos ese pedido.', 404);
  }
  if (o.payment_status !== 'approved') {
    throw new RunnerError('Este pedido todavía no está pagado.', 409);
  }
  return o;
}

export async function getRunnerOrder(
  service: SupabaseClient<any>,
  actor: RunnerActor,
  orderId: string
): Promise<RunnerOrder> {
  const o = await cargarPedido(service, actor, orderId);
  const reservas = await reservasVigentes(service, [orderId]);
  return aPedido(o, reservas.get(orderId) ?? null);
}

/** El patinador recogió en el local la parte de una tienda. */
export async function collectPart(
  service: SupabaseClient<any>,
  actor: RunnerActor,
  storeOrderId: string
): Promise<RunnerOrder> {
  const { data: parte } = await service
    .from('store_orders')
    .select('id, order_id, status, collected_at, stores ( name )')
    .eq('id', storeOrderId)
    .maybeSingle();

  if (!parte) throw new RunnerError('No encontramos ese pedido.', 404);

  // Comprueba plaza, pago y que sea un pedido con patinador.
  const o = await cargarPedido(service, actor, parte.order_id);

  // Marcarla dos veces no es un error: el patinador puede tocar el botón con
  // mala señal y repetir.
  if (!parte.collected_at) {
    if (o.bay_ready_at) {
      throw new RunnerError('Este pedido ya está en la bahía.', 409);
    }
    if (parte.status !== 'at_collection') {
      throw new RunnerError(
        `${(parte as any).stores?.name ?? 'La tienda'} todavía no tiene lista su parte.`,
        409
      );
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
 * Todo el pedido está en la bahía: se pide el mensajero.
 *
 * Pedirlo dos veces no manda dos mensajeros: si ya hay una reserva vigente se
 * devuelve el pedido tal cual. Si la solicitud a Pibox falla, el pedido queda
 * en la bahía igual —es donde está— y se puede volver a intentar.
 */
export async function markAtBay(
  service: SupabaseClient<any>,
  actor: RunnerActor,
  orderId: string
): Promise<BayOutcome> {
  const o = await cargarPedido(service, actor, orderId);
  const activas = (o.store_orders ?? []).filter((p: any) => !FUERA.includes(p.status));

  if (activas.length === 0) {
    throw new RunnerError('Todas las tiendas cancelaron su parte: no hay nada que despachar.', 409);
  }

  const pendientes = activas.filter((p: any) => p.status !== 'at_collection' || !p.collected_at);
  if (pendientes.length > 0) {
    const nombres = pendientes.map((p: any) => p.stores?.name ?? 'una tienda').join(', ');
    throw new RunnerError(`Falta recoger en: ${nombres}.`, 409);
  }

  const reservas = await reservasVigentes(service, [orderId]);
  if (reservas.has(orderId)) {
    return { order: aPedido(o, reservas.get(orderId)), deliveryError: null };
  }

  if (!o.bay_ready_at) {
    await service
      .from('orders')
      .update({ bay_ready_at: new Date().toISOString(), bay_ready_by: actor.userId })
      .eq('id', orderId)
      .is('bay_ready_at', null);
  }

  let deliveryError: string | null = null;

  // Con la integración apagada no hay a quién pedirle el mensajero: el pedido
  // queda en la bahía y se despacha por fuera.
  if (isPiboxEnabled()) {
    try {
      const { data: patinador } = await service.from('profiles').select('phone').eq('id', actor.userId).maybeSingle();
      const context = await loadOrderBookingContext(service, orderId, patinador?.phone ?? null);
      const booking = await createBooking(buildBookingPayload(context));
      await persistBookingSnapshot({ orderId }, booking);
    } catch (error: unknown) {
      deliveryError =
        error instanceof PiboxDataError
          ? error.message
          : `No se pudo pedir el mensajero: ${error instanceof Error ? error.message : 'error desconocido'}`;
      console.error(`runner: falló la solicitud del mensajero del pedido ${orderId}:`, error);
    }
  }

  return { order: await getRunnerOrder(service, actor, orderId), deliveryError };
}
