import type { SupabaseClient } from '@supabase/supabase-js';
import { getPqrsReason, STORE_VISIBLE_BUYER_REASONS } from './reasons';
import { signPaths } from './storage';
import { viewerOf, type PqrsActor } from './actor';
import { PqrsInputError } from './errors';
import { getBlockOfPqrs, loadBuyerStoreHistory } from '@/lib/stores/buyer-blocks';
import { getRefundOfPqrs, quoteRefund } from './refunds';
import type { PqrsRefundPreview } from './types';
import type { PqrsAttachment, PqrsDetail, PqrsStatus, PqrsSummary, PqrsViewer } from './types';

/**
 * Lectura de PQRS: el listado de cada puesto y el detalle de un caso.
 */

// `pqrs` apunta cuatro veces a `profiles`; hay que decir por cuál relación va
// cada nombre.
const SELECT_RESUMEN = `
  id, code, kind, reason, subject, status, outcome, opened_by, opened_as, store_id,
  store_response_due_at, created_at, updated_at,
  stores ( name ),
  store_orders ( code ),
  opener:profiles!pqrs_opened_by_fkey ( full_name ),
  buyer:profiles!pqrs_buyer_id_fkey ( full_name )
`;

function aResumen(row: any): PqrsSummary {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    reason: row.reason,
    reasonLabel: getPqrsReason(row.reason)?.label ?? row.reason,
    subject: row.subject,
    status: row.status,
    outcome: row.outcome,
    openedAs: row.opened_as,
    openedByName: row.opener?.full_name ?? null,
    buyerName: row.buyer?.full_name ?? null,
    storeId: row.store_id,
    storeName: row.stores?.name ?? null,
    orderCode: row.store_orders?.code ?? null,
    storeResponseDueAt: row.store_response_due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const PQRS_PAGE_SIZE = 20;

/** El motivo cuya aprobación crea un bloqueo. */
export const BLOCK_REASON = 'bloquear_comprador';

const SIN_PERMISO = 'No tienes permisos para ver estas PQRS.';

export interface PqrsListFilters {
  scope: PqrsViewer;
  status?: PqrsStatus | null;
  storeId?: string | null;
  page?: number;
}

export interface PqrsPage {
  items: PqrsSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listPqrs(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  filters: PqrsListFilters
): Promise<PqrsPage> {
  const page = Math.max(1, filters.page ?? 1);
  const desde = (page - 1) * PQRS_PAGE_SIZE;

  let query = service
    .from('pqrs')
    .select(SELECT_RESUMEN, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(desde, desde + PQRS_PAGE_SIZE - 1);

  if (filters.scope === 'admin') {
    if (!actor.isAdmin) throw new PqrsInputError(SIN_PERMISO, 403);
    if (filters.storeId) query = query.eq('store_id', filters.storeId);
  } else if (filters.scope === 'seller') {
    const tiendas = filters.storeId
      ? actor.storeIds.filter((id) => id === filters.storeId)
      : actor.storeIds;
    if (tiendas.length === 0) throw new PqrsInputError(SIN_PERMISO, 403);

    // Lo que abrió el equipo de la tienda, más los casos de compradores que le
    // competen. Es la misma regla de `viewerOf`, dicha en SQL.
    const motivos = STORE_VISIBLE_BUYER_REASONS.join(',');
    query = query
      .in('store_id', tiendas)
      .or(`opened_as.eq.seller,reason.in.(${motivos})`);
  } else {
    query = query.eq('opened_by', actor.userId).eq('opened_as', 'buyer');
  }

  if (filters.status) query = query.eq('status', filters.status);

  const { data, error, count } = await query;
  if (error) throw new Error(`No se pudieron cargar las PQRS: ${error.message}`);

  const total = count ?? 0;
  return {
    items: (data ?? []).map(aResumen),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PQRS_PAGE_SIZE)),
  };
}

/** El caso, o `null` si no existe o quien pregunta no lo puede ver. */
export async function getPqrsDetail(
  service: SupabaseClient<any>,
  actor: PqrsActor,
  id: string
): Promise<PqrsDetail | null> {
  const { data: row, error } = await service
    .from('pqrs')
    .select(
      `${SELECT_RESUMEN}, description, liable, store_response, store_responded_at,
       resolved_at, resolution_notes, buyer_id, order_id, store_order_id`
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar la PQRS: ${error.message}`);
  if (!row) return null;

  const viewer = viewerOf(actor, row as any);
  if (!viewer) return null;

  const [{ data: items }, { data: mensajes }, { data: adjuntos }] = await Promise.all([
    service
      .from('pqrs_items')
      .select('id, order_item_id, catalog_name, unit_name, quantity, unit_price')
      .eq('pqrs_id', id)
      .order('created_at', { ascending: true }),
    service
      .from('pqrs_messages')
      .select('id, author_as, body, is_internal, created_at, profiles ( full_name )')
      .eq('pqrs_id', id)
      .order('created_at', { ascending: true }),
    service
      .from('pqrs_attachments')
      .select('id, path, message_id')
      .eq('pqrs_id', id)
      .order('created_at', { ascending: true }),
  ]);

  // Las notas internas son de los administradores: se quitan acá, en el
  // servidor, y no escondiéndolas en la pantalla.
  const visibles = (mensajes ?? []).filter((m: any) => viewer === 'admin' || !m.is_internal);
  const idsVisibles = new Set(visibles.map((m: any) => m.id));
  const adjuntosVisibles = (adjuntos ?? []).filter(
    (a: any) => !a.message_id || idsVisibles.has(a.message_id)
  );

  const urls = await signPaths(service, adjuntosVisibles.map((a: any) => a.path));
  const conUrl: PqrsAttachment[] = adjuntosVisibles.map((a: any) => ({
    id: a.id,
    url: urls.get(a.path) ?? null,
    messageId: a.message_id,
  }));

  const abierta = row.status !== 'resolved';

  // Los casos del tendero contra un comprador traen el historial de ese
  // comprador en la tienda: es con lo que se decide. `viewerOf` ya garantiza que
  // el comprador nunca ve un caso abierto por la tienda.
  const contraComprador = row.opened_as === 'seller' && row.buyer_id && row.store_id;
  const [block, buyerHistory] = await Promise.all([
    row.reason === BLOCK_REASON ? getBlockOfPqrs(service, id) : Promise.resolve(null),
    contraComprador ? loadBuyerStoreHistory(service, row.store_id, row.buyer_id) : Promise.resolve(null),
  ]);

  const refund = row.outcome === 'approved' ? await getRefundOfPqrs(service, id, viewer) : null;
  const refundPreview = abierta ? await previewRefund(service, row, viewer) : null;

  return {
    ...aResumen(row),
    description: row.description,
    // Quién asume el costo es un dato de gestión: al comprador no se le manda.
    liable: viewer === 'buyer' ? null : row.liable,
    storeResponse: row.store_response,
    storeRespondedAt: row.store_responded_at,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    items: (items ?? []).map((i: any) => ({
      id: i.id,
      orderItemId: i.order_item_id,
      name: i.catalog_name,
      unit: i.unit_name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    })),
    attachments: conUrl.filter((a) => !a.messageId),
    messages: visibles.map((m: any) => ({
      id: m.id,
      authorAs: m.author_as,
      authorName: m.profiles?.full_name ?? null,
      body: m.body,
      isInternal: m.is_internal,
      createdAt: m.created_at,
      attachments: conUrl.filter((a) => a.messageId === m.id),
    })),
    block: block
      ? { id: block.id, createdAt: block.createdAt, liftedAt: block.liftedAt, liftNotes: block.liftNotes }
      : null,
    buyerHistory,
    refund,
    refundPreview,
    viewer,
    can: {
      // Resuelta, la conversación se cierra; el admin puede dejar constancia.
      message: abierta || viewer === 'admin',
      respondAsStore:
        row.status === 'awaiting_store' &&
        viewer === 'seller' &&
        row.opened_as === 'buyer',
      resolve: abierta && viewer === 'admin',
      liftBlock: viewer === 'admin' && Boolean(block && !block.liftedAt),
    },
  };
}

/**
 * Cuánto se devolvería si el caso se aprueba.
 *
 * Es la misma cuenta que después se guarda (`quoteRefund`), así que lo que ven
 * la tienda antes de aceptar y el admin antes de resolver es lo que pasa.
 */
async function previewRefund(
  service: SupabaseClient<any>,
  row: any,
  viewer: PqrsViewer
): Promise<PqrsRefundPreview | null> {
  const reason = getPqrsReason(row.reason);
  if (!reason || reason.refund === 'none' || !row.order_id) return null;

  // Una cantidad que ya no cuadra con el pedido no debe tumbar el detalle.
  const [items, order] = await Promise.all([
    quoteRefund(service, row, 'items').catch(() => null),
    viewer === 'admin' ? quoteRefund(service, row, 'order').catch(() => null) : Promise.resolve(null),
  ]);

  if (!items && !order) return null;

  return {
    // La tienda ve lo que le toca a ella, no lo que recibe el comprador.
    itemsTotal: viewer === 'seller' ? null : items?.total ?? null,
    itemsStoreCharge: viewer === 'buyer' ? null : items?.products ?? null,
    orderTotal: order?.total ?? null,
  };
}
