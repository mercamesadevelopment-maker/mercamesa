import { Database } from '@/types/database_generated';
import type { OrderInvoiceLink } from '@/lib/siigo/invoice-link';

export type OrderDetailRow = Database['public']['Views']['orders_detail_view']['Row'];

export interface OrderProduct {
  store_product_id: string;
  catalog_name: string;
  unit_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  /** Precio por unidad antes de la oferta. Nulo en pedidos viejos o sin descuento guardado. */
  list_unit_price?: number | null;
  image_url?: string;
}

export type OrderStatus = Database['public']['Enums']['order_status'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

// Viven en lib/ porque también los usa el servidor (el MCP de Meteor).
export { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/orders/status-labels';

export interface OrderDetail extends Omit<OrderDetailRow, 'products'> {
  products: OrderProduct[] | null;
  /** La factura de Siigo del pedido, como la ve el comprador (`/api/orders/my-orders`). */
  invoice?: OrderInvoiceLink | null;
}

export interface OrderStatusHistoryItem {
  id: string;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  changedByName: string | null;
  /** Corrección manual (regreso a un estado anterior), no un avance del flujo. */
  isReversal?: boolean;
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
