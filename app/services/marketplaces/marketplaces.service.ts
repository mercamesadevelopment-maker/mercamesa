import { SupabaseClient } from '@supabase/supabase-js';

export async function getMarketplaceDetail(
  supabase: SupabaseClient,
  slug: string
) {
  const { data, error } = await supabase
    .from('marketplaces_detail')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * A quién le vende cada tienda activa de una plaza, por id de tienda.
 *
 * `marketplaces_detail` arma las tiendas como JSON y no incluye `is_retail` ni
 * `is_wholesale`; se consultan aparte en vez de cambiar la vista.
 */
export async function getStoreSalesTypes(
  supabase: SupabaseClient,
  marketplaceId: string
): Promise<Map<string, { is_retail: boolean; is_wholesale: boolean }>> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, is_retail, is_wholesale')
    .eq('marketplace_id', marketplaceId)
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (data ?? []).map((s) => [s.id, { is_retail: s.is_retail, is_wholesale: s.is_wholesale }])
  );
}