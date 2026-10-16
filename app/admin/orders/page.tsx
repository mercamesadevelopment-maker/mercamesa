'use client';

import { useApp } from '@/src/store';
import { LogisticsOrdersView } from '@/src/features/logistics/components/LogisticsOrdersView';
import { OrdersView } from './components/orders-view';

/**
 * Logística entra acá por su permiso de lectura sobre el módulo, pero no ve la
 * vista del admin: ve la bahía de su plaza, con solo recibir y despachar.
 */
export default function AdminOrdersPage() {
  const { state } = useApp();
  if (!state._hydrated) return null;
  return state.userRole === 'logistics' ? <LogisticsOrdersView /> : <OrdersView />;
}
