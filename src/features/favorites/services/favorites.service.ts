import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { FavoriteStore } from '../types/favorite.types';

/**
 * Fetch favorite stores for a buyer, joined with the store info needed to display them.
 */
export async function fetchFavoriteStores(buyerId: string): Promise<FavoriteStore[]> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('store_favorites')
    .select(`
      store_id,
      stores (
        id, name, slug, logo_url, reputation_score,
        marketplaces ( name )
      )
    `)
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data
    .filter((row: any) => row.stores)
    .map((row: any) => {
      const store = row.stores;
      const logoUrl = store.logo_url
        ? supabase.storage.from('stores').getPublicUrl(store.logo_url).data.publicUrl
        : null;

      return {
        storeId: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl,
        marketplaceName: store.marketplaces?.name ?? null,
        reputationScore: store.reputation_score,
      } as FavoriteStore;
    });
}

/**
 * Fetch just the ids of favorite stores, for cheap "is this favorited" checks.
 */
export async function fetchFavoriteStoreIds(buyerId: string): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('store_favorites')
    .select('store_id')
    .eq('buyer_id', buyerId);

  if (error) throw error;
  return (data ?? []).map((row) => row.store_id);
}

export async function addFavoriteDb(buyerId: string, storeId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('store_favorites')
    .insert({ buyer_id: buyerId, store_id: storeId });

  // 23505 = unique_violation: already favorited, treat as success (idempotent)
  if (error && error.code !== '23505') throw error;
}

export async function removeFavoriteDb(buyerId: string, storeId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase
    .from('store_favorites')
    .delete()
    .eq('buyer_id', buyerId)
    .eq('store_id', storeId);

  if (error) throw error;
}
