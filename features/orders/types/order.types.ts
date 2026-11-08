import type { OrderItem } from '@/lib/orders/types';

export type OrderStatus = 'pending' | 'preparing' | 'on_the_way' | 'confirmed' | 'paid' | 'packing' | 'at_collection' | 'dispatched' | 'delivered' | 'cancelled' | 'returned';

export interface OrderStatusHistoryItem {
  id: string;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  changedByName: string | null;
  /** Corrección manual (regreso a un estado anterior), no un avance del flujo. */
  isReversal?: boolean;
}

export interface Order {
  /**
   * En el panel de pedidos de la tienda y del admin es el id de la parte
   * (`store_orders.id`), no el del pedido: un pedido de varias tiendas tiene una
   * tarjeta por tienda y cada una necesita su propio id (ver `toStoreOrderCard`).
   */
  id: string;
  storeOrderId?: string;
  /** Código visible del pedido de esta tienda: MM-2026-001017-1 */
  code?: string;
  /** Código de la compra completa, comun a todas las tiendas del carrito: MM-2026-001017 */
  parentCode?: string;
  /**
   * Cómo sale hacia el mensajero. `consolidated`: es un pedido de varias
   * tiendas; se junta en la bahía de la plaza y sale un solo mensajero, así que
   * la tienda no pide el domicilio.
   */
  fulfillment?: 'store' | 'consolidated';
  /** En un pedido de varias tiendas, cómo operaba la plaza al comprarlo. */
  consolidation?: { runnerRequired: boolean; logisticsRequired: boolean };
  /** Cómo va empacada la parte de la tienda, escrito por el tendero. */
  packingNotes?: string | null;
  /** Cuándo el patinador la recogió en el local. */
  collectedAt?: string | null;
  /** Cuándo logística la recibió en la bahía. */
  bayReceivedAt?: string | null;
  date: string;
  storeId: number | string;
  storeName: string;
  storeEmoji: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  buyerId: string;
  address: string;
  /** Indicaciones del comprador para llegar a la puerta (piso, apartamento, referencia). */
  deliveryInstructions?: string | null;
  paymentMethod: string;
  buyerName?: string;
  buyerPhone?: string | null;
  buyerEmail?: string | null;
  buyerDocument?: string | null;
  notes?: string | null;
  paymentStatus?: string;
  discount?: number;
  deliveryFee?: number;
  subtotal?: number;
  /** Comisión de servicio (2,99%) cobrada al comprador. */
  serviceCommission?: number;
  /** Mensajes de seguimiento cobrados al comprador. */
  messagesAmount?: number;
  /** Comisión de plataforma, "Servicio MercaMesa" en la factura. */
  platformCommission?: number;
  history?: OrderStatusHistoryItem[];
}
