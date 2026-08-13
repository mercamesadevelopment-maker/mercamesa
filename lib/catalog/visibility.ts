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
 * publicar. Sin grupo solo ve el catálogo público.
 */
export function applyCatalogVisibility<T>(query: T, storeGroupId: string | null): T {
  const filterable = query as unknown as {
    is: (column: string, value: null) => T;
    or: (filter: string) => T;
  };

  if (!storeGroupId) {
    return filterable.is('owner_group_id', null);
  }

  return filterable.or(`owner_group_id.is.null,owner_group_id.eq.${storeGroupId}`);
}

/** La misma regla en memoria, para validar filas ya cargadas sin volver a la base. */
export function canStoreUseCatalogProduct(
  ownerGroupId: string | null | undefined,
  storeGroupId: string | null
): boolean {
  if (!ownerGroupId) return true;
  return ownerGroupId === storeGroupId;
}

/** Mensaje único para que el vendedor entienda por qué se rechazó el producto. */
export const EXCLUSIVE_PRODUCT_MESSAGE =
  'Este producto del catálogo es exclusivo de otra tienda y no puedes publicarlo.';

/**
 * PostgREST manda los ids del `in.(...)` en la URL y la puerta de enlace de
 * Supabase la corta cerca de los 24 KB con un 400 sin explicación (medido: 650
 * uuids pasan, 687 fallan). 100 ids por consulta son unos 3,8 KB.
 */
const IN_CHUNK_SIZE = 100;

/** Resuelve `columna -> valor` para una lista de ids, por bloques. */
async function mapByIdInChunks(
  supabase: SupabaseClient<any>,
  table: string,
  column: string,
  ids: string[],
  errorPrefix: string
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map<string, string | null>();

  for (let index = 0; index < unique.length; index += IN_CHUNK_SIZE) {
    const chunk = unique.slice(index, index + IN_CHUNK_SIZE);

    const { data, error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .in('id', chunk);

    if (error) throw new Error(`${errorPrefix}: ${error.message}`);

    for (const row of (data ?? []) as any[]) {
      result.set(row.id as string, row[column] ?? null);
    }
  }

  return result;
}

/** Grupo de cada tienda. */
export function getStoreGroupIds(
  supabase: SupabaseClient<any>,
  storeIds: string[]
): Promise<Map<string, string | null>> {
  return mapByIdInChunks(
    supabase,
    'stores',
    'store_group_id',
    storeIds,
    'No se pudieron resolver los grupos de las tiendas'
  );
}

/** Dueño de cada producto del catálogo. */
export function getCatalogOwnerGroupIds(
  supabase: SupabaseClient<any>,
  catalogProductIds: string[]
): Promise<Map<string, string | null>> {
  return mapByIdInChunks(
    supabase,
    'catalog_products',
    'owner_group_id',
    catalogProductIds,
    'No se pudo verificar la exclusividad del catálogo'
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

  const [groupByStore, ownerByProduct] = await Promise.all([
    getStoreGroupIds(supabase, pairs.map((pair) => pair.storeId)),
    getCatalogOwnerGroupIds(supabase, pairs.map((pair) => pair.catalogProductId)),
  ]);

  const violations: number[] = [];
  pairs.forEach((pair, index) => {
    const ownerGroupId = ownerByProduct.get(pair.catalogProductId) ?? null;
    const storeGroupId = groupByStore.get(pair.storeId) ?? null;
    if (!canStoreUseCatalogProduct(ownerGroupId, storeGroupId)) violations.push(index);
  });

  return violations;
}
