/** Una línea de producto dentro de un pedido, como la guarda `orders.items`. */
export interface OrderItem {
  id: number | string;
  name: string;
  qty: number;
  price: number;
  unit: string;
  emoji: string;
  image?: string;
  notes?: string;
}

/** Cuerpo de `POST /api/orders`: lo arma el carrito y lo valida el servidor. */
export interface OrderItemInput {
  store_product_id: string
  quantity: number
  unit_price: number
  total_price: number
  catalog_name: string
  unit_name: string
  notes?: string | null
}

export interface StoreOrderInput {
  store_id: string
  order_id: string
  subtotal: number
  has_refrigerated?: boolean
  notes?: string
}

export interface CreateOrderPayload {
  order: {
    buyer_id: string
    buyer_type: 'retail' | 'wholesale'
    status: 'pending'
    payment_status: 'pending'
    notes?: string
    delivery_address_id?: string | null
    client_idempotency_key: string
    /** El comprador quiere usar su saldo a favor. Cuánto se usa lo decide el servidor. */
    use_credit?: boolean
  }
  items: OrderItemInput[]
  storeOrders: StoreOrderInput[]
}
