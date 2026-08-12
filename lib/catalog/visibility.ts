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

/** Grupo de cada tienda, resuelto en una sola consulta. */
export async function getStoreGroupIds(
  supabase: SupabaseClient<any>,
  storeIds: string[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(storeIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('stores')
    .select('id, store_group_id')
    .in('id', unique);

  if (error) throw new Error(`No se pudieron resolver los grupos de las tiendas: ${error.message}`);

  return new Map((data ?? []).map((store: any) => [store.id as string, store.store_group_id ?? null]));
}

/** Dueño de cada producto del catálogo, resuelto en una sola consulta. */
export async function getCatalogOwnerGroupIds(
  supabase: SupabaseClient<any>,
  catalogProductIds: string[]
): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(catalogProductIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('catalog_products')
    .select('id, owner_group_id')
    .in('id', unique);

  if (error) throw new Error(`No se pudo verificar la exclusividad del catálogo: ${error.message}`);

  return new Map((data ?? []).map((product: any) => [product.id as string, product.owner_group_id ?? null]));
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
