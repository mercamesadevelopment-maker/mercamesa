import {
  Bell, Loader2, Truck, CheckCircle2, XCircle, History, ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { OrderStatus } from '@/src/types';

export interface OrderStatusConfig {
  label: string;
  icon: LucideIcon;
  /** Badge sólido de la tarjeta en el listado. */
  badgeColor: string;
  /** Pill suave del encabezado del detalle. */
  pillColor: string;
  /** Texto corto del botón de avance en la tarjeta. */
  action: string | null;
  /** Texto largo del botón de avance en el detalle. */
  detailAction: string | null;
  next: OrderStatus | null;
}

/**
 * Etiqueta, colores y siguiente paso de cada estado en el panel de vendedor/admin.
 * Antes estaba copiado en `OrdersView` y en `OrderDetailModal`.
 */
export function getStatusConfig(status: OrderStatus): OrderStatusConfig {
  switch (status) {
    case 'pending':
      return {
        label: 'Nuevo',
        icon: Bell,
        badgeColor: 'bg-mm-oro text-white',
        pillColor: 'bg-mm-orl text-mm-oro border-mm-oro/20',
        action: 'Confirmar',
        detailAction: 'Confirmar Pedido',
        next: 'confirmed',
      };
    case 'confirmed':
      return {
        label: 'Confirmado',
        icon: CheckCircle2,
        badgeColor: 'bg-indigo-600 text-white',
        pillColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        action: 'Preparar',
        detailAction: 'Iniciar Empaque',
        next: 'packing',
      };
    case 'paid':
      return {
        label: 'Pagado',
        icon: CheckCircle2,
        badgeColor: 'bg-emerald-600 text-white',
        pillColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        action: 'Preparar',
        detailAction: 'Iniciar Empaque',
        next: 'packing',
      };
    case 'packing':
      return {
        label: 'Empacando',
        icon: Loader2,
        badgeColor: 'bg-blue text-white',
        pillColor: 'bg-blue-50 text-blue-700 border-blue-200',
        action: 'Listo Recogida',
        detailAction: 'Listo para Recoger',
        next: 'at_collection',
      };
    case 'at_collection':
      return {
        label: 'Listo Recogida',
        icon: ClipboardList,
        badgeColor: 'bg-purple-600 text-white',
        pillColor: 'bg-purple-50 text-purple-700 border-purple-200',
        action: 'Despachar',
        detailAction: 'Despachar Pedido',
        next: 'dispatched',
      };
    case 'dispatched':
      return {
        label: 'En Camino',
        icon: Truck,
        badgeColor: 'bg-mm-g text-white',
        pillColor: 'bg-amber-50 text-amber-700 border-amber-200',
        action: 'Entregado',
        detailAction: 'Marcar como Entregado',
        next: 'delivered',
      };
    case 'delivered':
      return {
        label: 'Entregado',
        icon: CheckCircle2,
        badgeColor: 'bg-mm-gbg text-mm-txs',
        pillColor: 'bg-green-50 text-green-700 border-green-200',
        action: null,
        detailAction: null,
        next: null,
      };
    case 'returned':
      return {
        label: 'Devuelto',
        icon: History,
        badgeColor: 'bg-slate-500 text-white',
        pillColor: 'bg-slate-50 text-slate-700 border-slate-200',
        action: null,
        detailAction: null,
        next: null,
      };
    default: // cancelled
      return {
        label: 'Cancelado',
        icon: XCircle,
        badgeColor: 'bg-r text-white',
        pillColor: 'bg-red-50 text-red-700 border-red-200',
        action: null,
        detailAction: null,
        next: null,
      };
  }
}

/**
 * Estados a los que se puede regresar un pedido: los que ya aparecen en su
 * historial (en orden cronológico, sin repetir) más `pending`, que es el estado
 * de nacimiento, excluyendo el actual. Misma regla que valida
 * `revert_store_order_status` en la base.
 */
export function getRevertTargets(
  currentStatus: OrderStatus,
  history: { status: OrderStatus }[] = []
): OrderStatus[] {
  const seen = new Set<OrderStatus>(['pending']);
  const targets: OrderStatus[] = ['pending'];

  for (const h of history) {
    if (!seen.has(h.status)) {
      seen.add(h.status);
      targets.push(h.status);
    }
  }

  return targets.filter((s) => s !== currentStatus);
}
