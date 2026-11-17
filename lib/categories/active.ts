import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export type CategoryRow = Database['public']['Tables']['categories']['Row'];

/**
 * Las categorías que se pueden elegir para un producto: solo las activas.
 *
 * Antes `/api/categories` devolvía también las inactivas. Al pasar a las
 * categorías comerciales (noviembre de 2026) las viejas quedaron inactivas, y el
 * formulario de producto las seguía ofreciendo: había dos «Frutas frescas» y
 * los productos nuevos caían en la vieja, que la vitrina mostraba como una
 * categoría madre suelta.
 *
 * Las inactivas solo se ven en Parametrización (`/api/admin/categories`), donde
 * se pueden reactivar.
 */
export function listActiveCategories(supabase: SupabaseClient<Database>): Promise<CategoryRow[]> {
  return fetchAllRows<CategoryRow>((from, to) =>
    supabase.from('categories').select('*').eq('is_active', true).order('name').order('id').range(from, to)
  );
}
