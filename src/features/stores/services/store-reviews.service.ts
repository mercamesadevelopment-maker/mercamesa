import type { ReviewInput, StoreReview } from '../types/review.types';

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export const storeReviewsService = {
  async getReviews(storeId: string): Promise<StoreReview[]> {
    return handle<StoreReview[]>(await fetch(`/api/stores/${storeId}/reviews`));
  },

  async submitReview(storeId: string, input: ReviewInput): Promise<StoreReview> {
    return handle<StoreReview>(
      await fetch(`/api/stores/${storeId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    );
  },
};
