import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONSOLIDATED_ORDER_SELECT,
  requestCourierIfReady,
  toConsolidatedOrder,
  type ConsolidatedOrder,
} from '@/lib/orders/consolidated-order';
import { activeParts, carrierOf } from '@/lib/orders/consolidation';
import { canWorkMarketplace, StaffError, type StaffActor } from '@/lib/marketplace-staff/actor';
import { fetchAllIn } from '@/lib/supabase/in-chunks';
import { areOwnUploads, FOTO_NO_VALIDA } from '@/lib/storage/private-photos';
import { canEditEvidence, canRecordReception, parseReceptionInput } from './reception-rules';
import { loadBayReceptions, notifyDamagedPart, saveBayEvidence, type BayReception } from './bay-reception';

/**
 * Los pedidos que pasan por la bahía de una plaza, vistos por logística.
 *
 * Logística recibe las partes de un pedido de varias tiendas (del patinador o
 * del tendero) y, con el domiciliario enfrente, valida el código de recogida y
 * lo marca «En camino». También ve los pedidos de una sola tienda de su plaza,
 * para poder despacharlos cuando el mensajero los recoge en la bahía.
 *
 * Solo hace esas dos cosas: no tiene el `update` general sobre las órdenes.
 * Todo acá espera el cliente de servicio; quien llama ya cargó al actor.
 */

/** Estados en los que la parte sigue en la plaza. */
const EN_PLAZA = ['confirmed', 'paid', 'packing', 'at_collection'];
const DESPACHADO = ['dispatched', 'delivered'];

export interface LogisticsItem {
  name: string;
  unit: string;
  quantity: number;
}

export interface LogisticsPart {
  storeOrderId: string;
  code: string;
  storeName: string;
  localAddress: string | null;
  packingNotes: string | null;
  status: string;
  collectedAt: string | null;
  bayReceivedAt: string | null;
  /** Lo que trae la parte: nombre, unidad y cantidad, sin precios. */
  items: LogisticsItem[];
  /** Puede registrar ahora la recepción («Recibido» o «Registrar recepción»). */
  canReceive: boolean;
  /** Ya la recibió y sigue en la plaza: puede agregar fotos o cambiar la observación. */
  canEditEvidence: boolean;
  reception: BayReception | null;
}

export interface LogisticsOrder {
  orderId: string;
  code: string;
  createdAt: string;
  marketplaceName: string | null;
  buyerName: string | null;
  consolidated: boolean;
  /** Quién trae las partes a la bahía. */
  carrier: 'runner' | 'store';
  stage: 'preparing' | 'at_bay' | 'dispatched' | 'closed';
  canDispatch: boolean;
  /** Informativa; solo en pedidos con patinador. */
  commissionAmount: number | null;
  parts: LogisticsPart[];
  booking: {
    simulated: boolean;
    driverName: string | null;
    driverPhone: string | null;
    vehiclePlates: string | null;
    pickupValidationCode: string | null;
  } | null;
}

/** Lo que la tarjeta muestra además del pedido: productos, recepciones y si la plaza tiene logística. */
interface Contexto {
  items: Map<string, LogisticsItem[]>;
  receptions: Map<string, BayReception>;
  plazasConLogistica: Set<string>;
}

const CONTEXTO_VACIO: Contexto = { items: new Map(), receptions: new Map(), plazasConLogistica: new Set() };

function aPedido(pedido: ConsolidatedOrder, reserva: any | null, ctx: Contexto = CONTEXTO_VACIO): LogisticsOrder {
  const consolidated = pedido.fulfillment === 'consolidated';
  // Uno de una sola tienda no pasa por «Recibido»: logística solo lo despacha.
  const cfg = consolidated ? pedido.config : { runnerRequired: false, logisticsRequired: false };
  const activas = activeParts(pedido.parts);

  const parts: LogisticsPart[] = pedido.parts.map((p) => ({
    storeOrderId: p.id,
    code: p.code,
    storeName: p.storeName,
    localAddress: p.localAddress,
    packingNotes: p.packingNotes,
    status: p.status,
    collectedAt: p.collectedAt,
    bayReceivedAt: p.bayReceivedAt,
    items: ctx.items.get(p.id) ?? [],
    canReceive: canRecordReception(p, {
      consolidated,
      config: cfg,
      marketplaceHasLogistics: Boolean(pedido.marketplaceId && ctx.plazasConLogistica.has(pedido.marketplaceId)),
    }),
    canEditEvidence: canEditEvidence(p),
    reception: ctx.receptions.get(p.id) ?? null,
  }));

  const todasListas =
    activas.length > 0 &&
    activas.every((p) => p.status === 'at_collection' && (!cfg.logisticsRequired || Boolean(p.bayReceivedAt)));

  let stage: LogisticsOrder['stage'];
  if (activas.length === 0 || activas.every((p) => p.status === 'delivered')) stage = 'closed';
  else if (activas.some((p) => DESPACHADO.includes(p.status))) stage = 'dispatched';
  else if (todasListas) stage = 'at_bay';
  else stage = 'preparing';

  return {
    orderId: pedido.id,
    code: pedido.code,
    createdAt: pedido.createdAt,
    marketplaceName: pedido.marketplaceName,
    buyerName: pedido.buyerName,
    consolidated,
    carrier: carrierOf(cfg),
    stage,
    canDispatch: stage === 'at_bay',
    commissionAmount: consolidated ? pedido.commission.amount : null,
    parts,
    booking: reserva
      ? {
          simulated: String(reserva.booking_id).startsWith('SIMULADO-'),
          driverName: reserva.driver_name ?? null,
          driverPhone: reserva.driver_phone ?? null,
          vehiclePlates: reserva.vehicle_plates ?? null,
          pickupValidationCode: reserva.pickup_validation_code ?? null,
        }
      : null,
  };
}

/** La reserva vigente de cada pedido: la del pedido entero o la de su única tienda. */
async function reservasVigentes(service: SupabaseClient<any>, pedidos: ConsolidatedOrder[]): Promise<Map<string, any>> {
  const porPedido = new Map<string, any>();
  if (pedidos.length === 0) return porPedido;

  const columnas = 'order_id, store_order_id, booking_id, driver_name, driver_phone, vehicle_plates, pickup_validation_code';
  const parteDe = new Map<string, string>();
  for (const p of pedidos) if (p.fulfillment === 'store' && p.parts[0]) parteDe.set(p.parts[0].id, p.id);

  const [{ data: dePedido }, { data: deTienda }] = await Promise.all([
    service.from('pibox_bookings').select(columnas).in('order_id', pedidos.map((p) => p.id)).eq('is_active', true),
    parteDe.size > 0
      ? service.from('pibox_bookings').select(columnas).in('store_order_id', Array.from(parteDe.keys())).eq('is_active', true)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  for (const r of dePedido ?? []) porPedido.set(r.order_id, r);
  for (const r of deTienda ?? []) porPedido.set(parteDe.get(r.store_order_id)!, r);
  return porPedido;
}

/**
 * Los productos de cada parte, las recepciones ya registradas y qué plazas
 * tienen logística, para todos los pedidos de una vez.
 */
async function cargarContexto(service: SupabaseClient<any>, pedidos: ConsolidatedOrder[]): Promise<Contexto> {
  if (pedidos.length === 0) return CONTEXTO_VACIO;

  const parteDe = new Map<string, string>();
  for (const p of pedidos) for (const parte of p.parts) parteDe.set(`${p.id}:${parte.storeId}`, parte.id);
  const plazas = Array.from(new Set(pedidos.map((p) => p.marketplaceId).filter((id): id is string => Boolean(id))));

  const [filas, receptions, { data: conLogistica }] = await Promise.all([
    fetchAllIn<any>(
      pedidos.map((p) => p.id),
      (ids, from, to) =>
        service
          .from('order_items')
          .select('order_id, catalog_name, unit_name, quantity, created_at, store_products!inner ( store_id )')
          .in('order_id', ids)
          .order('created_at', { ascending: true })
          .range(from, to)
    ),
    loadBayReceptions(service, Array.from(parteDe.values())),
    plazas.length > 0
      ? service.from('marketplaces').select('id').in('id', plazas).eq('logistics_enabled', true)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const items = new Map<string, LogisticsItem[]>();
  for (const f of filas) {
    const parte = parteDe.get(`${f.order_id}:${f.store_products?.store_id}`);
    if (!parte) continue;
    const lista = items.get(parte) ?? [];
    lista.push({ name: f.catalog_name, unit: f.unit_name, quantity: Number(f.quantity) });
    items.set(parte, lista);
  }

  return { items, receptions, plazasConLogistica: new Set((conLogistica ?? []).map((m: any) => m.id)) };
}

/** Las tiendas de las plazas de quien pregunta; `null` para un administrador (todas). */
async function tiendasDe(service: SupabaseClient<any>, actor: StaffActor): Promise<string[] | null> {
  if (actor.isAdmin) return null;
  const { data } = await service.from('stores').select('id').in('marketplace_id', actor.marketplaceIds);
  return (data ?? []).map((s: any) => s.id);
}

/**
 * Los pedidos de las plazas de quien pregunta.
 *
 * `open`: los que siguen en la plaza, lo más viejo primero. `closed`: los
 * últimos que salieron.
 */
export async function listLogisticsOrders(
  service: SupabaseClient<any>,
  actor: StaffActor,
  scope: 'open' | 'closed'
): Promise<LogisticsOrder[]> {
  if (!actor.isAdmin && actor.marketplaceIds.length === 0) return [];

  const tiendas = await tiendasDe(service, actor);
  if (tiendas && tiendas.length === 0) return [];

  let partes = service
    .from('store_orders')
    .select('order_id')
    .in('status', scope === 'open' ? EN_PLAZA : DESPACHADO)
    .order('updated_at', { ascending: false })
    .limit(scope === 'open' ? 300 : 60);
  if (tiendas) partes = partes.in('store_id', tiendas);

  const { data: filas, error: partesError } = await partes;
  if (partesError) throw new Error(`No se pudieron cargar los pedidos: ${partesError.message}`);

  const ids = Array.from(new Set((filas ?? []).map((f: any) => f.order_id)));
  if (ids.length === 0) return [];

  const { data, error } = await service
    .from('orders')
    .select(CONSOLIDATED_ORDER_SELECT)
    .in('id', ids)
    .eq('payment_status', 'approved');
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);

  const pedidos = (data ?? [])
    .map(toConsolidatedOrder)
    .filter((p) => canWorkMarketplace(actor, p.marketplaceId));
  const reservas = await reservasVigentes(service, pedidos);
  const ctx = await cargarContexto(service, pedidos);

  const vista = pedidos.map((p) => aPedido(p, reservas.get(p.id) ?? null, ctx));
  const enPlaza = (o: LogisticsOrder) => o.stage === 'preparing' || o.stage === 'at_bay';

  return scope === 'open'
    ? vista.filter(enPlaza).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : vista.filter((o) => !enPlaza(o)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
}

async function cargarPedido(service: SupabaseClient<any>, actor: StaffActor, orderId: string): Promise<ConsolidatedOrder> {
  const { data, error } = await service.from('orders').select(CONSOLIDATED_ORDER_SELECT).eq('id', orderId).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el pedido: ${error.message}`);

  const pedido = data ? toConsolidatedOrder(data) : null;
  // Un pedido de otra plaza responde igual que uno que no existe.
  if (!pedido || !canWorkMarketplace(actor, pedido.marketplaceId)) {
    throw new StaffError('No encontramos ese pedido.', 404);
  }
  if (pedido.paymentStatus !== 'approved') {
    throw new StaffError('Este pedido todavía no está pagado.', 409);
  }
  return pedido;
}

export async function getLogisticsOrder(
  service: SupabaseClient<any>,
  actor: StaffActor,
  orderId: string
): Promise<LogisticsOrder> {
  const pedido = await cargarPedido(service, actor, orderId);
  const [reservas, ctx] = await Promise.all([reservasVigentes(service, [pedido]), cargarContexto(service, [pedido])]);
  return aPedido(pedido, reservas.get(pedido.id) ?? null, ctx);
}

export interface ReceiveOutcome {
  order: LogisticsOrder;
  /** Por qué no se pudo pedir el mensajero, si ya tocaba y falló. */
  deliveryError: string | null;
}

/** Lee la entrada y comprueba que las fotos sean de quien las manda, antes de escribir nada. */
function leerEvidencia(actor: StaffActor, body: unknown, firstTime: boolean) {
  const leida = parseReceptionInput(body, { firstTime });
  if ('error' in leida) throw new StaffError(leida.error, 400);
  if (!areOwnUploads(actor.userId, leida.input.photos)) throw new StaffError(FOTO_NO_VALIDA, 400);
  return leida.input;
}

async function pedidoDeLaParte(service: SupabaseClient<any>, actor: StaffActor, storeOrderId: string) {
  const { data: fila } = await service.from('store_orders').select('order_id').eq('id', storeOrderId).maybeSingle();
  if (!fila) throw new StaffError('No encontramos ese pedido.', 404);

  const pedido = await cargarPedido(service, actor, fila.order_id);
  const parte = pedido.parts.find((p) => p.id === storeOrderId)!;
  return { pedido, parte };
}

async function avisarSiLlegoMal(
  service: SupabaseClient<any>,
  actor: StaffActor,
  pedido: ConsolidatedOrder,
  parte: ConsolidatedOrder['parts'][number],
  observation: string | null,
  newlyDamaged: boolean
) {
  if (!newlyDamaged) return;
  await notifyDamagedPart(service, {
    storeOrderId: parte.id,
    storeId: parte.storeId,
    storeName: parte.storeName,
    orderCode: pedido.code,
    observation: observation ?? '',
    actorId: actor.userId,
  });
}

/**
 * Logística recibió en la bahía la parte de una tienda, con fotos de cómo
 * llegó. En un pedido de varias tiendas, con la última parte se pide el
 * mensajero. En uno de una sola tienda es solo evidencia: el despacho no la
 * espera.
 *
 * Si la parte ya estaba recibida (un toque repetido), lo que llega se guarda
 * como evidencia de más, mientras siga en la plaza.
 */
export async function receivePart(
  service: SupabaseClient<any>,
  actor: StaffActor,
  storeOrderId: string,
  body: unknown
): Promise<ReceiveOutcome> {
  const { pedido, parte } = await pedidoDeLaParte(service, actor, storeOrderId);
  const consolidated = pedido.fulfillment === 'consolidated';

  if (parte.bayReceivedAt) {
    return { order: await updateEvidence(service, actor, storeOrderId, body), deliveryError: null };
  }

  if (consolidated && !pedido.config.logisticsRequired) {
    throw new StaffError('Este pedido no pasa por logística en la bahía.', 409);
  }

  const actual = await getLogisticsOrder(service, actor, pedido.id);
  const vista = actual.parts.find((p) => p.storeOrderId === storeOrderId)!;
  if (!vista.canReceive) {
    if (!consolidated && parte.status === 'at_collection') {
      throw new StaffError('Esta plaza no tiene logística en la bahía.', 409);
    }
    throw new StaffError(
      consolidated && pedido.config.runnerRequired
        ? `El patinador todavía no ha recogido la parte de ${parte.storeName}.`
        : `${parte.storeName} todavía no tiene lista su parte.`,
      409
    );
  }

  const input = leerEvidencia(actor, body, true);
  const { newlyDamaged } = await saveBayEvidence(service, { storeOrderId, userId: actor.userId, input, receiving: true });

  await service.from('store_order_status_history').insert({
    store_order_id: storeOrderId,
    status: parte.status,
    notes: input.damaged
      ? 'Logística recibió esta parte en la bahía, con novedad'
      : 'Logística recibió esta parte en la bahía',
    changed_by: actor.userId,
  });

  await avisarSiLlegoMal(service, actor, pedido, parte, input.observation, newlyDamaged);

  if (!consolidated) return { order: await getLogisticsOrder(service, actor, pedido.id), deliveryError: null };

  const { data: perfil } = await service.from('profiles').select('phone').eq('id', actor.userId).maybeSingle();
  const { error: deliveryError } = await requestCourierIfReady(
    service,
    pedido.id,
    perfil?.phone ?? null,
    actor.userId
  );

  return { order: await getLogisticsOrder(service, actor, pedido.id), deliveryError };
}

/**
 * Agrega fotos o cambia la observación de una parte ya recibida, mientras
 * siga en la plaza. Las fotos no se borran: si una salió mal, se sube otra.
 */
export async function updateEvidence(
  service: SupabaseClient<any>,
  actor: StaffActor,
  storeOrderId: string,
  body: unknown
): Promise<LogisticsOrder> {
  const { pedido, parte } = await pedidoDeLaParte(service, actor, storeOrderId);

  if (!parte.bayReceivedAt) throw new StaffError('Primero registra la recepción de esta parte.', 409);
  if (!canEditEvidence(parte)) {
    throw new StaffError('Esta parte ya salió de la plaza: su recepción ya no se puede cambiar.', 409);
  }

  const input = leerEvidencia(actor, body, false);
  const { newlyDamaged } = await saveBayEvidence(service, { storeOrderId, userId: actor.userId, input, receiving: false });
  await avisarSiLlegoMal(service, actor, pedido, parte, input.observation, newlyDamaged);

  return getLogisticsOrder(service, actor, pedido.id);
}

/**
 * Logística le entregó el pedido al domiciliario, después de validar con él el
 * código de recogida: todas las partes pasan a «En camino».
 *
 * Si el aviso de Pibox ya lo había hecho, no cambia nada.
 */
export async function dispatchOrder(
  service: SupabaseClient<any>,
  actor: StaffActor,
  orderId: string
): Promise<LogisticsOrder> {
  const pedido = await cargarPedido(service, actor, orderId);
  const actual = aPedido(pedido, null);

  if (actual.stage === 'dispatched' || actual.stage === 'closed') return getLogisticsOrder(service, actor, orderId);
  if (!actual.canDispatch) {
    const faltan = activeParts(actual.parts)
      .filter((p) => p.status !== 'at_collection' || (pedido.config.logisticsRequired && actual.consolidated && !p.bayReceivedAt))
      .map((p) => p.storeName);
    throw new StaffError(`Todavía falta en la bahía: ${faltan.join(', ')}.`, 409);
  }

  // Quién lo despachó desde la bahía: es lo que cuenta como servicio de logística.
  await service
    .from('orders')
    .update({ logistics_dispatched_at: new Date().toISOString(), logistics_dispatched_by: actor.userId })
    .eq('id', orderId)
    .is('logistics_dispatched_at', null);

  for (const p of activeParts(pedido.parts)) {
    const { data: cambiada } = await service
      .from('store_orders')
      .update({ status: 'dispatched' })
      .eq('id', p.id)
      .eq('status', 'at_collection')
      .select('id');

    if (cambiada && cambiada.length > 0) {
      await service.from('store_order_status_history').insert({
        store_order_id: p.id,
        status: 'dispatched',
        notes: 'Logística entregó el pedido al domiciliario',
        changed_by: actor.userId,
      });
    }
  }

  return getLogisticsOrder(service, actor, orderId);
}
