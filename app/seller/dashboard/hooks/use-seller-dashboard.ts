'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSellerStore } from '@/app/hooks/use-seller-store';

/** Estados que no representan ingreso: no suman a ninguna métrica de plata. */
const NON_REVENUE_STATUSES = ['cancelled', 'returned'] as const;

/** Estados en los que el pedido todavía espera algo del vendedor. */
const ACTIONABLE_STATUSES = ['pending', 'confirmed', 'paid', 'packing'] as const;

/** Días que cubre la gráfica de ingresos. */
const REVENUE_SERIES_DAYS = 30;

export interface DashboardOrder {
  storeOrderId: string;
  consecutive: number | null;
  status: string;
  subtotal: number;
  createdAt: string;
  /** Sin comprador la venta se hizo en el local; con comprador es un pedido digital. */
  isLocal: boolean;
  customerName: string;
}

export interface StockProduct {
  id: string;
  name: string;
  image: string;
  stock: number;
  unit: string;
}

/** Cuántos productos se listan en el panel de menor stock. */
const LOWEST_STOCK_COUNT = 6;

export interface RevenuePoint {
  /** Etiqueta corta para el eje (ej. "12 ago"). */
  label: string;
  date: string;
  total: number;
}

/**
 * Variación contra el periodo anterior. `null` cuando no hay con qué comparar:
 * un "+100%" contra cero no informa nada.
 */
export type Trend = { percent: number; isUp: boolean } | null;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function computeTrend(current: number, previous: number): Trend {
  if (previous <= 0) return null;
  const percent = ((current - previous) / previous) * 100;
  return { percent: Math.abs(Math.round(percent)), isUp: percent >= 0 };
}

export function useSellerDashboard() {
  const { stores, storeId, storeName, selectStore, loading: storeLoading } = useSellerStore();

  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [activeProductCount, setActiveProductCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [reputation, setReputation] = useState<{ score: number; reviewCount: number }>({
    score: 0,
    reviewCount: 0,
  });
  const [sellerName, setSellerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!storeId) return;

    const supabase = createSupabaseBrowserClient();
    setLoading(true);
    setError(null);

    try {
      // Desde el inicio del mes anterior: cubre a la vez el comparativo mensual
      // y la serie de los últimos 30 días con una sola consulta.
      const now = new Date();
      const since = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [ordersRes, productsRes, storeRes, reviewsRes] = await Promise.all([
        supabase
          .from('store_orders')
          .select(`
            id,
            status,
            subtotal,
            created_at,
            orders (
              consecutive,
              buyer_id,
              profiles ( full_name ),
              clients ( full_name )
            )
          `)
          .eq('store_id', storeId)
          .gte('created_at', since)
          .order('created_at', { ascending: false }),
        fetch(`/api/store-products?store_id=${storeId}`),
        supabase.from('stores').select('reputation_score').eq('id', storeId).maybeSingle(),
        supabase
          .from('store_reviews')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', storeId),
      ]);

      if (ordersRes.error) throw new Error(ordersRes.error.message);

      setOrders(
        (ordersRes.data ?? []).map((storeOrder: any) => {
          const order = storeOrder.orders;
          const isLocal = !order?.buyer_id;
          return {
            storeOrderId: storeOrder.id,
            consecutive: order?.consecutive ?? null,
            status: storeOrder.status,
            subtotal: Number(storeOrder.subtotal) || 0,
            createdAt: storeOrder.created_at,
            isLocal,
            customerName:
              (isLocal ? order?.clients?.full_name : order?.profiles?.full_name) ||
              (isLocal ? 'Consumidor final' : 'Cliente online'),
          };
        })
      );

      if (productsRes.ok) {
        const json = await productsRes.json();
        const items: StockProduct[] = (json.data ?? [])
          .filter((item: any) => item.is_active)
          .map((item: any) => ({
            id: item.id,
            name: item.catalog_products?.name || 'Producto',
            image: item.imageSignedUrl || '',
            stock: Number(item.stock),
            unit: item.measurement_units?.abbreviation || 'und',
          }));

        setActiveProductCount(items.length);
        setOutOfStockCount(items.filter((item) => item.stock <= 0).length);

        // No hay columna de stock mínimo en store_products, así que no existe un
        // umbral real de "stock bajo": se listan los de menos existencias, que
        // es un dato cierto y accionable. (`min_order_qty` es el pedido mínimo
        // de compra, no un punto de reposición: compararlo contra el stock
        // marcaba 611 de 617 productos como críticos.)
        setProducts(
          [...items].sort((a, b) => a.stock - b.stock).slice(0, LOWEST_STOCK_COUNT)
        );
      }

      setReputation({
        score: Number(storeRes.data?.reputation_score) || 0,
        reviewCount: reviewsRes.count ?? 0,
      });
    } catch (err) {
      console.error('Error cargando el dashboard del vendedor:', err);
      setError(err instanceof Error ? err.message : 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const loadSellerName = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      setSellerName(data?.full_name?.split(' ')[0] || '');
    };

    loadSellerName();
  }, []);

  /** Solo los pedidos que representan plata cobrada o por cobrar. */
  const revenueOrders = useMemo(
    () => orders.filter((order) => !NON_REVENUE_STATUSES.includes(order.status as any)),
    [orders]
  );

  const metrics = useMemo(() => {
    const today = startOfDay(new Date());
    const yesterday = addDays(today, -1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const sumBetween = (from: Date, to: Date) =>
      revenueOrders.reduce((acc, order) => {
        const date = new Date(order.createdAt);
        return date >= from && date < to ? acc + order.subtotal : acc;
      }, 0);

    const todayRevenue = sumBetween(today, addDays(today, 1));
    const yesterdayRevenue = sumBetween(yesterday, today);
    const monthRevenue = sumBetween(monthStart, addDays(today, 1));
    const previousMonthRevenue = sumBetween(previousMonthStart, monthStart);

    const localRevenue = revenueOrders
      .filter((order) => order.isLocal)
      .reduce((acc, order) => acc + order.subtotal, 0);
    const digitalRevenue = revenueOrders
      .filter((order) => !order.isLocal)
      .reduce((acc, order) => acc + order.subtotal, 0);

    return {
      todayRevenue,
      todayTrend: computeTrend(todayRevenue, yesterdayRevenue),
      todayOrderCount: revenueOrders.filter((order) => new Date(order.createdAt) >= today).length,
      monthRevenue,
      monthTrend: computeTrend(monthRevenue, previousMonthRevenue),
      localRevenue,
      digitalRevenue,
      pendingOrders: orders.filter((order) => ACTIONABLE_STATUSES.includes(order.status as any))
        .length,
    };
  }, [orders, revenueOrders]);

  /**
   * Serie por día con los días sin ventas incluidos: si se omiten, la gráfica
   * comprime el eje y sugiere una continuidad que no existe.
   */
  const revenueSeries = useMemo<RevenuePoint[]>(() => {
    const totalByDay = new Map<string, number>();
    for (const order of revenueOrders) {
      const key = startOfDay(new Date(order.createdAt)).toDateString();
      totalByDay.set(key, (totalByDay.get(key) ?? 0) + order.subtotal);
    }

    const today = startOfDay(new Date());
    return Array.from({ length: REVENUE_SERIES_DAYS }, (_, index) => {
      const date = addDays(today, index - (REVENUE_SERIES_DAYS - 1));
      return {
        date: date.toISOString(),
        label: date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        total: totalByDay.get(date.toDateString()) ?? 0,
      };
    });
  }, [revenueOrders]);

  const recentActivity = useMemo(() => orders.slice(0, 5), [orders]);

  const hasSales = revenueOrders.length > 0;

  return {
    stores,
    storeId,
    storeName,
    selectStore,
    sellerName,
    loading: loading || storeLoading,
    error,
    metrics,
    revenueSeries,
    recentActivity,
    lowestStockProducts: products,
    outOfStockCount,
    activeProductCount,
    reputation,
    hasSales,
    refresh: fetchDashboard,
  };
}
