import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Las categorías de una tienda viven en `store_category_links`, no en la columna
 * `stores.category_id` (obsoleta): una tienda de plaza vende carnes Y lácteos.
 *
 * Esto lo usan tanto crear como editar una tienda, así que vive acá y no dentro
 * de una ruta.
 */

export class CategoryLinksError extends Error {}

/**
 * Normaliza lo que llegó en el cuerpo. Devuelve `null` si el campo no venía
 * —que significa "no tocar las categorías", distinto de "quitarlas todas"—.
 */
export function parseCategoryIds(raw: unknown): string[] | null {
  if (raw === undefined) return null;
  if (raw === null) return [];

  if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) {
    throw new CategoryLinksError('Las categorías de la tienda no tienen un formato válido.');
  }

  // Un mismo id repetido reventaría contra el único compuesto de la tabla.
  return Array.from(new Set(raw as string[]));
}

/**
 * Deja la tienda exactamente con las categorías indicadas: quita las que sobran
 * y agrega las que faltan, en vez de borrar todo y reinsertar. Así un fallo a
 * mitad de camino no deja la tienda sin ninguna categoría.
 */
export async function setStoreCategories(
  supabase: SupabaseClient<any>,
  storeId: string,
  categoryIds: string[]
): Promise<void> {
  if (categoryIds.length > 0) {
    // Que existan y estén activas. Sin esto, un `PUT` hecho a mano podía dejar
    // vínculos a categorías inventadas o retiradas del catálogo.
    const { data: valid, error: checkError } = await supabase
      .from('store_categories')
      .select('id')
      .in('id', categoryIds)
      .eq('is_active', true);

    if (checkError) {
      console.error('store_category_links: validación falló', checkError);
      throw new CategoryLinksError('No se pudieron verificar las categorías seleccionadas.');
    }

    if ((valid ?? []).length !== categoryIds.length) {
      throw new CategoryLinksError('Alguna de las categorías seleccionadas ya no está disponible.');
    }
  }

  const { data: current, error: readError } = await supabase
    .from('store_category_links')
    .select('category_id')
    .eq('store_id', storeId);

  if (readError) {
    console.error('store_category_links: lectura falló', readError);
    throw new CategoryLinksError('No se pudieron leer las categorías actuales de la tienda.');
  }

  const actuales = new Set((current ?? []).map((r: { category_id: string }) => r.category_id));
  const deseadas = new Set(categoryIds);

  const sobran = [...actuales].filter((id) => !deseadas.has(id));
  const faltan = [...deseadas].filter((id) => !actuales.has(id));

  if (sobran.length > 0) {
    const { error } = await supabase
      .from('store_category_links')
      .delete()
      .eq('store_id', storeId)
      .in('category_id', sobran);

    if (error) {
      console.error('store_category_links: borrado falló', error);
      throw new CategoryLinksError('No se pudieron actualizar las categorías de la tienda.');
    }
  }

  if (faltan.length > 0) {
    const { error } = await supabase
      .from('store_category_links')
      .insert(faltan.map((category_id) => ({ store_id: storeId, category_id })));

    if (error) {
      console.error('store_category_links: inserción falló', error);
      throw new CategoryLinksError('No se pudieron actualizar las categorías de la tienda.');
    }
  }
}
