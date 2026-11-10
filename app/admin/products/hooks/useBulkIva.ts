import { useState } from 'react';
import { applyBulkIva } from '../services/bulk-iva.service';

/**
 * Estado de la acción masiva «Cambiar IVA»: la tarifa elegida, la
 * confirmación, la espera y el error.
 */
export function useBulkIva(onApplied: () => void) {
  const [ivaRate, setIvaRate] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (productIds: string[]) => {
    if (productIds.length === 0) return;
    setApplying(true);
    try {
      await applyBulkIva(productIds, ivaRate);
      setConfirmOpen(false);
      onApplied();
    } catch (err: unknown) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el IVA');
    } finally {
      setApplying(false);
    }
  };

  return { ivaRate, setIvaRate, confirmOpen, setConfirmOpen, applying, error, clearError: () => setError(null), apply };
}
