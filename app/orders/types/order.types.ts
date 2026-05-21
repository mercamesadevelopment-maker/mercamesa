import { Database } from '@/types/database_generated';

export type OrderDetailRow = Database['public']['Views']['orders_detail_view']['Row'];

export interface OrderProduct {
  store_product_id: string;
  catalog_name: string;
  unit_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string;
}

export type OrderStatus = Database['public']['Enums']['order_status'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

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

export interface OrderDetail extends Omit<OrderDetailRow, 'products'> {
  products: OrderProduct[] | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OrderStats {
  totalOrders: number;
  totalSpent: number;
  thisWeekOrders: number;
}
