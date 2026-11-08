import type { OrderItemInput } from '@/lib/orders/types'

export interface ZonapagosCompraData {
  idPago: string
  total: number
  iva?: number
  descripcion: string
  email: string
  idCliente: string
  tipoIdCliente: string
  nombreCliente: string
  apellidoCliente: string
  telefonoCliente: string
  orderId: string          // enviado en str_opcional1 para trazabilidad en el callback
  guardarTarjeta?: boolean // si es true, se pide tokenización (int_codigo 200) a Zonapagos
}

export interface ZonapagosPayload {
  compraData: ZonapagosCompraData
}

export interface ZonapagosResponse {
  // Campos reales que retorna Zonapagos
  int_codigo?: number              // 1 = ok, 2 = error
  str_cod_error?: string | null
  str_descripcion_error?: string | null
  str_url?: string | null          // URL al portal de pago — campo principal
  // Aliases legacy por si cambia la respuesta
  url_pago?: string
  str_url_pago?: string
  error?: string
  mensaje?: string
  [key: string]: unknown
}

export interface CreateOrderResponse {
  data: {
    id: string
    buyer_id: string
    buyer_type: string
    status: string
    payment_status: string
    /** Saldo a favor apartado para este pedido. */
    credit_applied?: number
    subtotal: number
    delivery_fee: number
    discount: number
    total: number
    notes: string | null
    delivery_address_id: string | null
    client_idempotency_key: string
    created_at: string
    updated_at: string
    order_items?: OrderItemInput[]
  }
  idempotent: boolean
}

