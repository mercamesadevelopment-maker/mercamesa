import { useCallback, useState } from 'react';
import { approveProductService, fetchPendingReviewCountService } from '../services/review.service';

/**
 * Productos que propusieron los tenderos desde la carga masiva: cuántos esperan
 * revisión, y aprobar uno.
 */
export function usePendingReview() {
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    fetchPendingReviewCountService()
      .then(setCount)
      .catch(() => {
        // El contador es una ayuda: si falla, la pantalla sigue igual.
      });
  }, []);

  const approve = useCallback(async (id: string, name: string) => {
    try {
      await approveProductService(id);
    } catch (err: unknown) {
      setError(`${name}: ${err instanceof Error ? err.message : 'No se pudo aprobar.'}`);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { count, refreshCount, approve, error, clearError };
}
