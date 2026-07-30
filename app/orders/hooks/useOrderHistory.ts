import { useState, useEffect } from 'react';
import { OrderStatusHistoryItem } from '../types/order.types';

export function useOrderHistory(orderId: string | null, storeId: string | null) {
  const [history, setHistory] = useState<OrderStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId || !storeId) {
      setHistory([]);
      return;
    }

    let cancelled = false;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/${orderId}/history?store_id=${storeId}`);
        const result = await res.json();
        if (!cancelled) setHistory(res.ok ? result.data || [] : []);
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [orderId, storeId]);

  return { history, loading };
}
