import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, paymentMethodId } = await req.json()

    if (!orderId || !paymentMethodId) {
      throw new Error('orderId y paymentMethodId son requeridos')
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await callerClient.auth.getUser()

    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Confirmar que el método de pago pertenece al comprador autenticado
    const { data: paymentMethod, error: paymentMethodError } = await supabase
      .from('buyer_payment_methods')
      .select('id, zonapagos_token')
      .eq('id', paymentMethodId)
      .eq('buyer_id', user.id)
      .single()

    if (paymentMethodError || !paymentMethod?.zonapagos_token) {
      throw new Error('Método de pago no encontrado o sin token válido')
    }

    // Confirmar que la orden pertenece al comprador autenticado
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, total')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single()

    if (orderError || !order) {
      throw new Error('Orden no encontrada')
    }

    const idComercio = parseInt(Deno.env.get('ZONAPAGOS_ID_COMERCIO') || '0')
    const usuario = Deno.env.get('ZONAPAGOS_USUARIO')
    const clave = Deno.env.get('ZONAPAGOS_CLAVE')

    const strIdPago = Date.now().toString()
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'

    const pagoPayload = {
      int_id_comercio: idComercio,
      str_usuario: usuario,
      str_clave: clave,
      str_tipo_identificador: '1',
      str_identificador: paymentMethod.zonapagos_token,
      str_id_pago: strIdPago,
      str_total_con_iva: String(order.total),
      str_valor_iva: '0',
      int_no_cuotas: 1,
      str_descripcion_pago: `Pedido ${orderId}`,
      str_direccion_ip_cliente: clientIp,
    }

    const response = await fetch('https://zonapagos.com/ApisToken/api/PagoAPTC', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pagoPayload),
    })

    const result = await response.json()
    const estado = parseInt(String(result?.int_estado_transaccion ?? -1))

    let paymentStatus: 'approved' | 'rejected' | 'pending' = 'pending'
    if (estado === 1) paymentStatus = 'approved'
    else if (estado === 2) paymentStatus = 'rejected'

    await supabase.from('payments').insert({
      order_id: orderId,
      provider: 'zonapagos',
      str_id_pago: strIdPago,
      status: paymentStatus,
      amount: order.total,
      payment_url: null,
      callback_response: result,
    })

    const orderUpdate: Record<string, unknown> = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    }
    if (paymentStatus === 'approved') {
      orderUpdate.status = 'confirmed'
    }

    await supabase.from('orders').update(orderUpdate).eq('id', orderId)

    if (paymentStatus === 'approved') {
      await supabase.from('cart_items').delete().eq('order_id', orderId)
    } else if (paymentStatus === 'rejected') {
      const { data: pendingItems } = await supabase
        .from('cart_items')
        .select('id, buyer_id, store_product_id, quantity')
        .eq('order_id', orderId)

      if (pendingItems) {
        for (const item of pendingItems) {
          const { data: activeItem } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('buyer_id', item.buyer_id)
            .eq('store_product_id', item.store_product_id)
            .eq('status', 'active')
            .maybeSingle()

          if (activeItem) {
            await supabase
              .from('cart_items')
              .update({ quantity: activeItem.quantity + item.quantity, updated_at: new Date().toISOString() })
              .eq('id', activeItem.id)

            await supabase.from('cart_items').delete().eq('id', item.id)
          } else {
            await supabase
              .from('cart_items')
              .update({ status: 'active', order_id: null, updated_at: new Date().toISOString() })
              .eq('id', item.id)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, estado, paymentStatus, rawResponse: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
