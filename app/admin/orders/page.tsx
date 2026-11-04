'use client';

import { useSession } from '@/features/auth/session-context';
import { LogisticsOrdersView } from '@/features/logistics/components/LogisticsOrdersView';
import { OrdersView } from './components/orders-view';

/**
 * Logística entra acá por su permiso de lectura sobre el módulo, pero no ve la
 * vista del admin: ve la bahía de su plaza, con solo recibir y despachar.
 */
export default function AdminOrdersPage() {
  const session = useSession();
  if (!session.hydrated) return null;
  return session.role === 'logistics' ? <LogisticsOrdersView /> : <OrdersView />;
}
