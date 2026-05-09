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