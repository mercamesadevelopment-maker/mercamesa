import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bloqueo de un comprador en una tienda.
 *
 * `store_buyer_blocks` no tiene políticas: todo lo de acá espera el cliente de
 * servicio, y quien llama ya comprobó quién pregunta.
 */

/**
 * Lo que lee el comprador bloqueado. No dice quién lo pidió ni por qué —eso lo
 * decidió MercaMesa con la tienda— pero sí le deja una salida.
 */
export const BUYER_BLOCKED_MESSAGE =
  'Esta tienda no está recibiendo pedidos de tu cuenta. Puedes comprar en las demás tiendas; si crees que es un error, escríbenos desde «PQRS».';

export class BuyerBlockedError extends Error {
  constructor() {
    super(BUYER_BLOCKED_MESSAGE);
    this.name = 'BuyerBlockedError';
  }
}

export async function isBuyerBlocked(
  service: SupabaseClient<any>,
  storeId: string,
  buyerId: string
): Promise<boolean> {
  const { data, error } = await service
    .from('store_buyer_blocks')
    .select('id')
    .eq('store_id', storeId)
    .eq('buyer_id', buyerId)
    .is('lifted_at', null)
    .limit(1);

  // Si la consulta falla NO se deja pasar: un bloqueo que se salta cuando la
  // base tose no es un bloqueo. El comprador reintenta y ya.
  if (error) throw new Error(`No se pudo verificar el bloqueo: ${error.message}`);

  return (data ?? []).length > 0;
}

export interface BuyerBlock {
  id: string;
  storeId: string;
  buyerId: string;
  buyerName: string | null;
  reason: string;
  createdAt: string;
  liftedAt: string | null;
  liftNotes: string | null;
  pqrsCode: string | null;
}

// Tres relaciones con `profiles`: hay que decir cuál es el comprador.
const SELECT_BLOQUEO = `
  id, store_id, buyer_id, reason, created_at, lifted_at, lift_notes,
  buyer:profiles!store_buyer_blocks_buyer_id_fkey ( full_name ),
  pqrs ( code )
`;

function aBloqueo(row: any): BuyerBlock {
  return {
    id: row.id,
    storeId: row.store_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer?.full_name ?? null,
    reason: row.reason,
    createdAt: row.created_at,
    liftedAt: row.lifted_at,
    liftNotes: row.lift_notes,
    pqrsCode: row.pqrs?.code ?? null,
  };
}

/** Los bloqueos vigentes de una tienda. */
export async function listActiveBlocks(service: SupabaseClient<any>, storeId: string): Promise<BuyerBlock[]> {
  const { data, error } = await service
    .from('store_buyer_blocks')
    .select(SELECT_BLOQUEO)
    .eq('store_id', storeId)
    .is('lifted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`No se pudieron cargar los bloqueos: ${error.message}`);
  return (data ?? []).map(aBloqueo);
}

/** El bloqueo que salió de una solicitud, vigente o ya levantado. */
export async function getBlockOfPqrs(service: SupabaseClient<any>, pqrsId: string): Promise<BuyerBlock | null> {
  const { data, error } = await service
    .from('store_buyer_blocks')
    .select(SELECT_BLOQUEO)
    .eq('pqrs_id', pqrsId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el bloqueo: ${error.message}`);
  return data ? aBloqueo(data) : null;
}

/**
 * Bloquea. Si ya había un bloqueo vigente no hace nada: el índice único lo
 * frena y eso es justo lo que se quiere al aprobar dos veces.
 */
export async function blockBuyer(
  service: SupabaseClient<any>,
  params: { storeId: string; buyerId: string; pqrsId: string; reason: string; blockedBy: string }
): Promise<void> {
  const { error } = await service.from('store_buyer_blocks').insert({
    store_id: params.storeId,
    buyer_id: params.buyerId,
    pqrs_id: params.pqrsId,
    reason: params.reason,
    blocked_by: params.blockedBy,
  });

  if (error && error.code !== '23505') {
    throw new Error(`No se pudo registrar el bloqueo: ${error.message}`);
  }
}

/** Levanta el bloqueo. Devuelve `false` si ya no estaba vigente. */
export async function liftBlock(
  service: SupabaseClient<any>,
  params: { blockId: string; liftedBy: string; notes: string }
): Promise<boolean> {
  const { data, error } = await service
    .from('store_buyer_blocks')
    .update({ lifted_at: new Date().toISOString(), lifted_by: params.liftedBy, lift_notes: params.notes })
    .eq('id', params.blockId)
    .is('lifted_at', null)
    .select('id');

  if (error) throw new Error(`No se pudo levantar el bloqueo: ${error.message}`);
  return (data ?? []).length > 0;
}

export interface BuyerStoreHistory {
  total: number;
  delivered: number;
  cancelled: number;
  /** Pedidos que nunca se pagaron y vencieron. */
  expiredUnpaid: number;
  /** Pedidos con el pago rechazado. */
  paymentRejected: number;
}

/**
 * Cómo le ha ido a este comprador en esta tienda. Es lo que el administrador
 * mira para decidir un bloqueo: «cancela todo» deja de ser la palabra del
 * tendero y pasa a ser un número.
 */
export async function loadBuyerStoreHistory(
  service: SupabaseClient<any>,
  storeId: string,
  buyerId: string
): Promise<BuyerStoreHistory> {
  const { data, error } = await service
    .from('store_orders')
    .select('status, orders!inner ( buyer_id, payment_status, expired_at )')
    .eq('store_id', storeId)
    .eq('orders.buyer_id', buyerId)
    .limit(1000);

  if (error) throw new Error(`No se pudo cargar el historial: ${error.message}`);

  const pedidos = data ?? [];
  return {
    total: pedidos.length,
    delivered: pedidos.filter((p: any) => p.status === 'delivered').length,
    cancelled: pedidos.filter((p: any) => p.status === 'cancelled').length,
    expiredUnpaid: pedidos.filter((p: any) => p.orders?.expired_at).length,
    paymentRejected: pedidos.filter((p: any) => p.orders?.payment_status === 'rejected').length,
  };
}
