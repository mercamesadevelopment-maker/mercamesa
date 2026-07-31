import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getPublicSupabaseUrl } from '@/lib/env'
import {
  ZonapagosPayload,
  ZonapagosResponse,
  CreateOrderPayload,
  CreateOrderResponse,
} from '@/src/features/payment/types/payment.types'

export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

export async function initiateZonapagosPayment(
  compraData: ZonapagosPayload['compraData']
): Promise<ZonapagosResponse> {
  const supabaseUrl = getPublicSupabaseUrl()
  const supabase = createSupabaseBrowserClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Usuario no autenticado')
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/zonapagos-inicio`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ compraData }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Error al iniciar el pago con Zonapagos')
  }

  const result: ZonapagosResponse = await response.json()
  return result
}

export async function createOrderWithItems(
  payload: CreateOrderPayload
): Promise<CreateOrderResponse> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Error al crear la orden')
  }

  const result: CreateOrderResponse = await response.json()
  return result
}

export async function syncPaymentStatus(orderId: string): Promise<{ success: boolean; paymentStatus: string }> {
  const supabaseUrl = getPublicSupabaseUrl()
  const supabase = createSupabaseBrowserClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Usuario no autenticado')
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/zonapagos-sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Error al sincronizar el pago')
  }

  const result = await response.json()
  return result
}

export interface PayWithSavedCardResult {
  success: boolean
  estado: number
  paymentStatus: 'approved' | 'rejected' | 'pending'
  rawResponse: unknown
}

export async function payWithSavedCard(
  orderId: string,
  paymentMethodId: string
): Promise<PayWithSavedCardResult> {
  const supabaseUrl = getPublicSupabaseUrl()
  const supabase = createSupabaseBrowserClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Usuario no autenticado')
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/zonapagos-pago-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId, paymentMethodId }),
    }
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Error al cobrar con la tarjeta guardada')
  }

  return result as PayWithSavedCardResult
}

export function getPaymentUrl(result: any): string | null {
  return (
    result?.str_url ||
    result?.url_pago ||
    result?.str_url_pago ||
    null
  )
}
