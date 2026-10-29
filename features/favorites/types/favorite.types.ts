import type { Database } from '@/types/database_generated';

export type StoreFavoriteRow = Database['public']['Tables']['store_favorites']['Row'];

export interface FavoriteStore {
  storeId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  marketplaceName: string | null;
  reputationScore: number | null;
}
