import type { RoleKey } from '@/lib/auth/roles';
export type { RoleKey };


export interface MasterProduct {
  id: number;
  name: string;
  cat: string;
  emoji: string;
  image?: string;
  defaultUnit: string;
  defaultUnitId?: string;
}

export interface Product {
  id: number | string;
  plazaId: number;
  storeId: number | string;
  storeName?: string;
  emoji: string;
  image?: string;
  name: string;
  /** Código propio de la tienda (store_products.code). Vacío en los publicados antes de existir la columna. */
  code?: string;
  cat: string;
  categoryId?: string;
  unit: string;
  unitId?: string;
  isFeatured?: boolean;
  /** Producto nuevo que propuso la tienda y el admin todavía no revisa. */
  inReview?: boolean;
  retailPrice: number;
  wsPrice: number;
  ws20: number;
  ws50: number;
  wsMin: number;
  stock: number;
  minStock: number;
  masterId?: number | string;
  desc: string;
  status: 'active' | 'inactive';
  /**
   * En cuántos pedidos aparece este producto.
   *
   * Solo lo trae el panel del tendero: `order_items` es la única clave foránea
   * que impide borrarlo, así que este número es lo que decide si se puede
   * eliminar o solo desactivar. En la vitrina pública no viaja.
   */
  orderCount?: number;
}

export interface CartItem extends Product {
  qty: number;
  unitId?: string;
  unitName?: string;
  offerId?: string | null;
  offerExpired?: boolean;
  originalOfferPrice?: number;
  /**
   * Precio del inventario antes de la oferta.
   *
   * `retailPrice` llega ya sobrescrito con el precio rebajado, así que sin esto
   * el original se pierde y no hay cómo decirle al comprador cuánto se ahorró.
   * Solo viene cuando hay una oferta vigente aplicada.
   */
  listPrice?: number;
  notes?: string;
}

import type { OrderItem } from '@/lib/orders/types';

// Vive en lib porque el servidor también lo usa.
export type { OrderItem };

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

/** Lo que la interfaz sabe de quien tiene la sesión. Lo demás de su perfil lo pide cada pantalla. */
export interface BuyerProfile {
  id: string;
  role_id?: string;
  name: string;
  email: string;
  avatar: string;
}

export interface AppNotification {
  id: string;
  type: 'order_new' | 'price_update' | 'rating' | 'payment' | 'store_offer_pending' | 'store_offer_reviewed' | 'delivery_update';
  title: string;
  msg: string;
  time: string;
  read: boolean;
  entityType?: string | null;
  entityId?: string | null;
}

