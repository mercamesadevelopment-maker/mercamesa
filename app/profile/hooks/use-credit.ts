'use client';

import { useEffect, useState } from 'react';
import type { BuyerCredit } from '@/lib/pqrs/refunds';
import { fetchBuyerCredit } from '../services/credit.service';

/** El saldo a favor del comprador y sus movimientos. */
export function useCredit() {
  const [credit, setCredit] = useState<BuyerCredit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    fetchBuyerCredit()
      .then((data) => vigente && setCredit(data))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : 'No pudimos cargar tu saldo.'))
      .finally(() => vigente && setLoading(false));
    return () => {
      vigente = false;
    };
  }, []);

  return { credit, loading, error };
}
