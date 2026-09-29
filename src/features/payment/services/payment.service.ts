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

/** Los mensajes con los que el checkout manda al comprador a completar su perfil. */
export const PERFIL_SIN_DOCUMENTO = 'El usuario no tiene documento registrado'
export const PERFIL_SIN_EMAIL = 'El usuario no tiene email registrado'

/** Los datos del comprador que pide ZonaPagos. */
export interface PerfilDePago {
  email: string
  documento: string
  nombre: string
  apellido: string
  telefono: string
}

/**
 * Lee y valida los datos del comprador que pide la pasarela. Sin documento o
 * sin correo no se puede pagar; el carrito lo comprueba ANTES de crear el
 * pedido y manda a completar el perfil (ver los dos mensajes de arriba).
 */
export async function obtenerPerfilDePago(): Promise<PerfilDePago> {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuario no autenticado')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone, document_number')
    .eq('id', user.id)
    .single()

  if (!profile) {
    throw new Error('No se encontró el perfil del usuario')
  }
  if (!profile.document_number) {
    throw new Error(PERFIL_SIN_DOCUMENTO)
  }
  if (!profile.email) {
    throw new Error(PERFIL_SIN_EMAIL)
  }

  const nameParts = (profile.full_name || '').trim().split(' ')
  return {
    email: profile.email,
    documento: String(profile.document_number),
    nombre: nameParts[0] || 'Cliente',
    apellido: nameParts.slice(1).join(' ') || 'MercaMesa',
    telefono: profile.phone || '0000000000',
  }
}

/**
 * Abre un intento de pago en ZonaPagos para un pedido que ya existe y devuelve
 * el enlace de la pasarela.
 *
 * Lo usan el carrito, justo después de crear el pedido, y el botón «Pagar» de
 * «Mis órdenes», para reintentar uno pendiente. El monto no viaja: lo lee
 * `zonapagos-inicio` de la orden, que además rechaza un pedido que ya no se
 * puede pagar.
 */
export async function iniciarPagoDeOrden(
  orderId: string,
  opciones: { perfil?: PerfilDePago; storeName?: string; guardarTarjeta?: boolean } = {}
): Promise<string> {
  const perfil = opciones.perfil ?? (await obtenerPerfilDePago())

  const result = await initiateZonapagosPayment({
    // Un identificador por intento: ZonaPagos no acepta repetirlo, y la sonda
    // consulta cada intento por el suyo.
    idPago: Date.now().toString(),
    orderId,
    // Informativo: `zonapagos-inicio` cobra el total guardado en la orden.
    total: 0,
    iva: 0,
    descripcion: opciones.storeName ? `Pedido ${orderId} - ${opciones.storeName}` : `Pedido ${orderId}`,
    email: perfil.email,
    idCliente: perfil.documento,
    tipoIdCliente: '1',
    nombreCliente: perfil.nombre,
    apellidoCliente: perfil.apellido,
    telefonoCliente: perfil.telefono,
    guardarTarjeta: opciones.guardarTarjeta ?? false,
  })

  const paymentUrl = getPaymentUrl(result)
  if (paymentUrl) return paymentUrl

  const detalle =
    typeof result?.str_descripcion_error === 'string'
      ? result.str_descripcion_error
      : typeof result?.error === 'string'
      ? result.error
      : typeof result?.mensaje === 'string'
      ? result.mensaje
      : 'No se obtuvo URL de pago'
  throw new Error(detalle)
}
