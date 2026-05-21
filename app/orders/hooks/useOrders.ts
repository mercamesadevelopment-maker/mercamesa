import { useState, useCallback, useMemo, useEffect } from 'react';
import { OrderDetail, OrderStats, PaginationMeta } from '../types/order.types';

interface UseOrdersOptions {
  page?: number;
  limit?: number;
  storeId?: string | null;
  status?: string | null;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (options.page) params.set('page', options.page.toString());
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.storeId) params.set('store_id', options.storeId);
      if (options.status) params.set('status', options.status);

      const response = await fetch(`/api/orders/my-orders?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Error fetching orders');

      setOrders(result.data || []);
      setMeta(result.meta || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.page, options.limit, options.storeId, options.status]);

  // Re-fetch when options change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const stats = useMemo<OrderStats>(() => {
    // Note: These stats are currently based only on the visible orders (current page).
    // In a real app, we might want a separate endpoint for global stats or a more complex query.
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      totalOrders: meta?.total || orders.length,
      totalSpent: orders.reduce((acc, order) => acc + (order.total || 0), 0),
      thisWeekOrders: orders.filter(order => {
        if (!order.created_at) return false;
        return new Date(order.created_at) > oneWeekAgo;
      }).length,
    };
  }, [orders, meta]);

  return {
    orders,
    meta,
    loading,
    error,
    stats,
    fetchOrders,
  };
}
