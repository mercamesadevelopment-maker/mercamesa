import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Exclusividad del catálogo maestro por grupo de tiendas.
 *
 * `catalog_products.owner_group_id` marca de quién es el producto:
 *   - `null`  → público, cualquier tienda puede publicarlo.
 *   - un id   → solo las tiendas de ese grupo (`stores.store_group_id`).
 *
 * Existe porque las tiendas que aportan productos también aportan sus fotos, y
 * sin esto cualquier otra tienda podría publicar el producto reutilizando la
 * imagen ajena. El grupo, y no la tienda, es el dueño: un mismo comerciante
 * puede tener otra tienda en otro sector y ambas deben compartir el catálogo.
 *
 * Ojo: `catalog_products` y `store_products` no tienen RLS, así que estos
 * chequeos en las rutas son el único control real. Filtrar solo las lecturas no
 * protege nada; lo que cierra la puerta es la validación en la escritura.
 */

/** Grupo al que pertenece una tienda, o `null` si no está en ninguno. */
export async function getStoreGroupId(
  supabase: SupabaseClient<any>,
  storeId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('store_group_id')
    .eq('id', storeId)
    .single();

  if (error) throw new Error(`No se pudo resolver el grupo de la tienda: ${error.message}`);

  return (data?.store_group_id as string | null) ?? null;
}

/**
 * Restringe una consulta a `catalog_products` a lo que esa tienda puede
 * publicar:
 * - los aprobados públicos, y los de su grupo si tiene uno;
 * - los que ella misma propuso y siguen en revisión (`review_status = 'pending'`).
 *   Los pendientes de otras tiendas no se ofrecen.
 */
export function applyCatalogVisibility<T>(query: T, storeGroupId: string | null, storeId: string): T {
  const filterable = query as unknown as { or: (filter: string) => T };

  const aprobados = storeGroupId
    ? `and(review_status.eq.approved,or(owner_group_id.is.null,owner_group_id.eq.${storeGroupId}))`
    : 'and(review_status.eq.approved,owner_group_id.is.null)';

  return filterable.or(`${aprobados},proposed_by_store_id.eq.${storeId}`);
}

/** Lo que decide si una tienda puede publicar un producto del catálogo. */
export interface CatalogAccess {
  ownerGroupId: string | null;
  reviewStatus: string | null;
  proposedByStoreId: string | null;
}

/** Por qué una tienda no puede publicar un producto. */
export type CatalogDenial = 'in_review' | 'other_group';

/** La regla en memoria: `null` si la tienda puede publicarlo, o el motivo si no. */
export function catalogDenialReason(
  product: CatalogAccess,
  store: { id: string; groupId: string | null }
): CatalogDenial | null {
  if (product.reviewStatus === 'pending') return product.proposedByStoreId === store.id ? null : 'in_review';
  if (!product.ownerGroupId) return null;
  return product.ownerGroupId === store.groupId ? null : 'other_group';
}

/** La misma regla, como sí o no, para validar filas ya cargadas sin volver a la base. */
export function canStoreUseCatalogProduct(
  product: CatalogAccess,
  store: { id: string; groupId: string | null }
): boolean {
  return catalogDenialReason(product, store) === null;
}

/** Mensaje genérico, para cuando no se pueden dar nombres (el archivo de importación, varias tiendas). */
export const EXCLUSIVE_PRODUCT_MESSAGE =
  'Este producto del catálogo es exclusivo de otra tienda y no puedes publicarlo.';

/**
 * El rechazo con nombres. El genérico decía «de otra tienda» también cuando
 * el producto era del grupo de la propia tienda y a ella le faltaba estar en
 * el grupo: así no había cómo saber qué arreglar.
 */
export function catalogDenialMessage(params: {
  reason: CatalogDenial;
  storeName: string | null;
  ownerGroupName: string | null;
}): string {
  if (params.reason === 'in_review') {
    return 'Este producto del catálogo todavía está en revisión: solo lo puede publicar la tienda que lo propuso.';
  }
  if (!params.ownerGroupName) return EXCLUSIVE_PRODUCT_MESSAGE;

  const tienda = params.storeName ? `la tienda «${params.storeName}»` : 'esta tienda';
  return (
    `Este producto del catálogo es exclusivo del grupo «${params.ownerGroupName}» y ${tienda} no pertenece a ese grupo. ` +
    'Un administrador puede agregarla al grupo en Parametrización → Grupos de tiendas.'
  );
}

/**
 * Explica por qué esa tienda no puede publicar ese producto, con el nombre del
 * grupo dueño y de la tienda. Quien llama ya sabe que hay un rechazo; si algo
 * falla al leer, devuelve el mensaje genérico en vez de ocultar el rechazo.
 */
export async function explainCatalogDenial(
  supabase: SupabaseClient<any>,
  pair: { storeId: string; catalogProductId: string }
): Promise<string> {
  const [{ data: producto }, { data: tienda }] = await Promise.all([
    supabase
      .from('catalog_products')
      .select('owner_group_id, review_status, proposed_by_store_id, store_groups!owner_group_id ( name )')
      .eq('id', pair.catalogProductId)
      .maybeSingle(),
    supabase.from('stores').select('name, store_group_id').eq('id', pair.storeId).maybeSingle(),
  ]);
  if (!producto) return EXCLUSIVE_PRODUCT_MESSAGE;

  const reason = catalogDenialReason(
    {
      ownerGroupId: producto.owner_group_id ?? null,
      reviewStatus: producto.review_status ?? null,
      proposedByStoreId: producto.proposed_by_store_id ?? null,
    },
    { id: pair.storeId, groupId: tienda?.store_group_id ?? null }
  );
  if (!reason) return EXCLUSIVE_PRODUCT_MESSAGE;

  return catalogDenialMessage({
    reason,
    storeName: tienda?.name ?? null,
    ownerGroupName: (producto as any).store_groups?.name ?? null,
  });
}

/**
 * PostgREST manda los ids del `in.(...)` en la URL y la puerta de enlace de
 * Supabase la corta cerca de los 24 KB con un 400 sin explicación (medido: 650
 * uuids pasan, 687 fallan). 100 ids por consulta son unos 3,8 KB.
 */
const IN_CHUNK_SIZE = 100;

/** Resuelve `id -> fila` para una lista de ids, por bloques. */
async function mapByIdInChunks<TRow>(
  supabase: SupabaseClient<any>,
  table: string,
  columns: string,
  ids: string[],
  errorPrefix: string
): Promise<Map<string, TRow>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map<string, TRow>();

  for (let index = 0; index < unique.length; index += IN_CHUNK_SIZE) {
    const chunk = unique.slice(index, index + IN_CHUNK_SIZE);

    const { data, error } = await supabase
      .from(table)
      .select(`id, ${columns}`)
      .in('id', chunk);

    if (error) throw new Error(`${errorPrefix}: ${error.message}`);

    for (const row of (data ?? []) as any[]) {
      result.set(row.id as string, row as TRow);
    }
  }

  return result;
}

/** Grupo de cada tienda. */
async function getStoreGroupIds(
  supabase: SupabaseClient<any>,
  storeIds: string[]
): Promise<Map<string, string | null>> {
  const filas = await mapByIdInChunks<{ store_group_id: string | null }>(
    supabase,
    'stores',
    'store_group_id',
    storeIds,
    'No se pudieron resolver los grupos de las tiendas'
  );
  return new Map(Array.from(filas, ([id, fila]) => [id, fila.store_group_id ?? null]));
}

/** Dueño y estado de revisión de cada producto del catálogo. */
async function getCatalogAccess(
  supabase: SupabaseClient<any>,
  catalogProductIds: string[]
): Promise<Map<string, CatalogAccess>> {
  const filas = await mapByIdInChunks<{
    owner_group_id: string | null;
    review_status: string | null;
    proposed_by_store_id: string | null;
  }>(
    supabase,
    'catalog_products',
    'owner_group_id, review_status, proposed_by_store_id',
    catalogProductIds,
    'No se pudo verificar la exclusividad del catálogo'
  );
  return new Map(
    Array.from(filas, ([id, fila]) => [
      id,
      {
        ownerGroupId: fila.owner_group_id ?? null,
        reviewStatus: fila.review_status ?? null,
        proposedByStoreId: fila.proposed_by_store_id ?? null,
      },
    ])
  );
}

/**
 * Verifica de una sola pasada que cada par (tienda, producto) sea publicable.
 * Devuelve los índices de los pares que violan la exclusividad, para que quien
 * llama decida si responde 403 o reporta la fila del archivo.
 */
export async function findExclusivityViolations(
  supabase: SupabaseClient<any>,
  pairs: Array<{ storeId: string; catalogProductId: string }>
): Promise<number[]> {
  if (pairs.length === 0) return [];

  const [groupByStore, accessByProduct] = await Promise.all([
    getStoreGroupIds(supabase, pairs.map((pair) => pair.storeId)),
    getCatalogAccess(supabase, pairs.map((pair) => pair.catalogProductId)),
  ]);

  const violations: number[] = [];
  pairs.forEach((pair, index) => {
    const access = accessByProduct.get(pair.catalogProductId) ?? {
      ownerGroupId: null,
      reviewStatus: null,
      proposedByStoreId: null,
    };
    const store = { id: pair.storeId, groupId: groupByStore.get(pair.storeId) ?? null };
    if (!canStoreUseCatalogProduct(access, store)) violations.push(index);
  });

  return violations;
}
