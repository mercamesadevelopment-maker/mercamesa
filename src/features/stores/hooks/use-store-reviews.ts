'use client';

import { useState, useCallback, useMemo } from 'react';
import { useApp } from '@/src/store';
import { storeReviewsService } from '../services/store-reviews.service';
import type { ReviewInput, StoreReview } from '../types/review.types';

export function useStoreReviews(storeId?: string) {
  const { state } = useApp();
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await storeReviewsService.getReviews(storeId);
      setReviews(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando las reseñas');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const submitReview = useCallback(async (targetStoreId: string, input: ReviewInput) => {
    try {
      setSubmitting(true);
      setError(null);
      await storeReviewsService.submitReview(targetStoreId, input);
      if (targetStoreId === storeId) await fetchReviews();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando la reseña');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [storeId, fetchReviews]);

  const myReview = useMemo(
    () => reviews.find((r) => r.buyer_id === state.buyerProfile?.id) || null,
    [reviews, state.buyerProfile?.id]
  );

  return { reviews, myReview, loading, submitting, error, fetchReviews, submitReview };
}
