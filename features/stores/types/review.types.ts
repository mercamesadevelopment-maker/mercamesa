import { Database } from '@/types/database_generated';

export type StoreReview = Database['public']['Tables']['store_reviews']['Row'] & {
  profiles?: { full_name: string } | null;
};

export interface ReviewInput {
  stars: number;
  comment: string;
}
