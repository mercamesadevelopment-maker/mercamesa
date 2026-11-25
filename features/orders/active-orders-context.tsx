'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from '@/features/auth/session-context';
import { buyerOrderProgress, type BuyerProgress } from '@/lib/orders/buyer-progress';
import type { DeliveryStage, DeliveryView } from '@/lib/pibox/delivery-view';
import type { OrderDetail } from '@/app/orders/types/order.types';
import { isPayable } from './hooks/use-pay-order';

/**
 * Los pedidos en curso del comprador, para tenerlos a la vista: arriba de la
 * página de inicio (`ActiveOrderCard`) y en la burbuja que lo acompaña por la app
 * (`ActiveOrderBubble`). Los dos abren el mismo detalle del pedido.
 *
 * Solo para compradores con sesión. Vuelve a consultar cada minuto, o cada 30 s
 * si un domicilio se está moviendo, y no consulta con la pestaña oculta. Lee lo
 * que ya está guardado (`GET /api/orders/active`): no le pega a Pibox.
 */

export interface ActiveOrder {
  order: OrderDetail;
  delivery: DeliveryView | null;
  /** La misma frase y el mismo paso que muestra el detalle del pedido. */
  progress: BuyerProgress;
  /** Cambia cuando el pedido avanza: con ella la burbuja sabe qué es nuevo. */
  signature: string;
}

interface ActiveOrdersValue {
  /** Es un comprador con sesión: solo a ellos se les muestra. */
  enabled: boolean;
  orders: ActiveOrder[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

const LIVE_STAGES: DeliveryStage[] = ['searching', 'assigned', 'picking_up', 'on_the_way'];
const POLL_MS = 60_000;
const LIVE_POLL_MS = 30_000;

const ActiveOrdersContext = createContext<ActiveOrdersValue | undefined>(undefined);

function toActiveOrder(item: { order: OrderDetail; delivery: DeliveryView | null }): ActiveOrder {
  const progress = buyerOrderProgress(item.order.status, item.delivery, { payable: isPayable(item.order.payable_until) });
  return {
    ...item,
    progress,
    signature: `${item.order.status}|${item.delivery?.stage ?? ''}|${progress.title}`,
  };
}

export function ActiveOrdersProvider({ children }: { children: ReactNode }) {
  const { hydrated, isLoggedIn, role } = useSession();
  const enabled = hydrated && isLoggedIn && (role === 'retail' || role === 'wholesale');
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/orders/active', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setOrders(((json.data ?? []) as { order: OrderDetail; delivery: DeliveryView | null }[]).map(toActiveOrder));
    } catch {
      // Sin red: se queda con lo último que supo y lo intenta en la próxima vuelta.
    } finally {
      setLoaded(true);
    }
  }, [enabled]);

  const live = orders.some((o) => o.delivery && LIVE_STAGES.includes(o.delivery.stage));

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setLoaded(false);
      return;
    }
    let cancelado = false;
    const vuelta = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      await refresh();
    };
    const programar = () => {
      timer.current = setTimeout(async () => {
        await vuelta();
        if (!cancelado) programar();
      }, live ? LIVE_POLL_MS : POLL_MS);
    };
    vuelta();
    programar();
    const alVolver = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      cancelado = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [enabled, live, refresh]);

  const value = useMemo(() => ({ enabled, orders, loaded, refresh }), [enabled, orders, loaded, refresh]);
  return <ActiveOrdersContext.Provider value={value}>{children}</ActiveOrdersContext.Provider>;
}

export function useActiveOrders(): ActiveOrdersValue {
  const context = useContext(ActiveOrdersContext);
  if (!context) throw new Error('useActiveOrders must be used within ActiveOrdersProvider');
  return context;
}
