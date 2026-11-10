import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { uniqueViolationMessage, DUPLICATE_FALLBACK_MESSAGE } from '@/lib/db/unique-violation';
import { CATEGORY_SLUG_INDEX } from '@/lib/admin/settings-messages';
import {
  buildCategoryBatch,
  countErrors,
  draftFromBatchRow,
  draftFromCategory,
  mergeDrafts,
  validateCategories,
  type CategoryBatchRow,
  type CategoryErrors,
} from './batch';

export type SaveBatchResult =
  | { ok: true; created: Record<string, string>; saved: number }
  | { ok: false; status: number; message: string; errors?: CategoryErrors };

/**
 * Guarda los cambios de la tabla de categorías, todos juntos.
 *
 * No confía en lo que manda el navegador: arma la tabla con lo que hay en la
 * base y los cambios encima, la valida con las mismas reglas que la pantalla,
 * genera los slugs de las nuevas y lo guarda en una sola transacción
 * (`guardar_categorias`). Quien llama ya comprobó la sesión y los permisos.
 */
export async function saveCategoryBatch(
  supabase: SupabaseClient<any>,
  filas: Partial<CategoryBatchRow>[]
): Promise<SaveBatchResult> {
  const guardadas = await fetchAllRows<any>((from, to) =>
    supabase
      .from('categories')
      .select('id, slug, name, parent_id, description, sort_order, is_active')
      .order('id')
      .range(from, to)
  );

  const originales = guardadas.map(draftFromCategory);
  const tabla = mergeDrafts(originales, filas.map(draftFromBatchRow));

  const errores = validateCategories(tabla, originales);
  if (countErrors(errores) > 0) {
    return { ok: false, status: 400, message: 'Hay celdas por corregir antes de guardar.', errors: errores };
  }

  const lote = buildCategoryBatch(originales, tabla, new Set(guardadas.map((c) => c.slug)));
  if (lote.length === 0) return { ok: true, created: {}, saved: 0 };

  const { data, error } = await supabase.rpc('guardar_categorias', { p_filas: lote });

  if (error) {
    const mensaje =
      uniqueViolationMessage(error, { [CATEGORY_SLUG_INDEX]: 'Otra persona creó una categoría con el mismo nombre mientras tanto. Recarga e intenta de nuevo.' }) ??
      (error.code === '23505' ? DUPLICATE_FALLBACK_MESSAGE : null) ??
      // Las reglas del árbol y los permisos: los mensajes de la función ya son para personas.
      (error.code === 'P0001' ? error.message : null) ??
      (error.code === '42501' ? 'No tienes permisos para crear categorías.' : 'No se pudieron guardar las categorías.');
    console.error('Error guardando categorías en lote:', error.message);
    return { ok: false, status: 400, message: mensaje };
  }

  return { ok: true, created: (data ?? {}) as Record<string, string>, saved: lote.length };
}

/** Si el lote crea, edita o las dos cosas: cada una pide su permiso. */
export function batchNeeds(filas: Partial<CategoryBatchRow>[]): { create: boolean; update: boolean } {
  return { create: filas.some((f) => !f.id), update: filas.some((f) => Boolean(f.id)) };
}
