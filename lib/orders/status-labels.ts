import type { Database } from '@/types/database_generated';

type OrderStatus = Database['public']['Enums']['order_status'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

/** Cómo se le nombra cada estado al comprador: en la app y en el chat de Meteor. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  paid: 'Pagado',
  packing: 'Empacando',
  at_collection: 'En recolección',
  dispatched: 'Despachado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  returned: 'Devuelto',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  refunded: 'Reembolsado',
  disputed: 'Disputado',
};
