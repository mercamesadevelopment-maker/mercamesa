import type { OrderItem } from '@/lib/orders/types';

export type SaleStatus = 'pedido' | 'preparado' | 'entregado' | 'pagado';

export interface Sale {
  id: number | string;
  date: string;
  storeId: number | string;
  items: OrderItem[];
  total: number;
  status: SaleStatus;
  customerName?: string;
  customerID?: string;
  customerEmail?: string;
}
