import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * PostgREST manda los ids del `in.(...)` en la URL, y la puerta de enlace de
 * Supabase la corta alrededor de los 24 KB devolviendo un 400 con el cuerpo
 * "Bad Request", sin JSON ni motivo. Medido contra el proyecto: 650 uuids
 * (24.133 caracteres) pasan y 687 (25.502) fallan.
 *
 * Con ~37 caracteres por uuid codificado, 100 ids son unos 3,8 KB: muy por
 * debajo del corte, y sigue siendo un solo UPDATE por bloque.
 *
 * Sin esto, cambiar un puñado de productos funcionaba y una selección grande
 * fallaba sin explicación posible para el usuario.
 */
const UPDATE_CHUNK_SIZE = 100;

export type BulkUpdateResult = { updated: number; error?: undefined } | { updated: number; error: string };

/**
 * Aplica los mismos valores a varios productos del catálogo, por bloques. Lo
 * usan las acciones masivas del catálogo (grupo exclusivo, IVA).
 *
 * Si un bloque falla, devuelve cuántos alcanzaron a cambiar: las acciones son
 * idempotentes, así que reintentar la misma selección no duplica nada.
 *
 * `catalog_products` no tiene RLS: quien llama ya comprobó el permiso.
 */
export async function updateCatalogProducts(
  supabase: SupabaseClient<any>,
  productIds: string[],
  values: Record<string, unknown>
): Promise<BulkUpdateResult> {
  let updated = 0;

  for (let index = 0; index < productIds.length; index += UPDATE_CHUNK_SIZE) {
    const chunk = productIds.slice(index, index + UPDATE_CHUNK_SIZE);

    const { data, error } = await supabase.from('catalog_products').update(values).in('id', chunk).select('id');

    if (error) {
      return { updated, error: `${error.message} (se alcanzaron a actualizar ${updated} de ${productIds.length} productos)` };
    }

    updated += data?.length ?? 0;
  }

  return { updated };
}

/** Los ids del cuerpo de una acción masiva, o `null` si no viene ninguno. */
export function bulkProductIds(body: { product_ids?: unknown }): string[] | null {
  if (!Array.isArray(body.product_ids) || body.product_ids.length === 0) return null;
  const ids = body.product_ids.map((value: unknown) => String(value)).filter(Boolean);
  return ids.length > 0 ? ids : null;
}
