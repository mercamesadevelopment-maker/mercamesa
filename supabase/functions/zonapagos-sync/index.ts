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
    const { orderId } = await req.json()

    if (!orderId) {
      throw new Error('orderId is required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get payment info
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('str_id_pago, order_id')
      .eq('order_id', orderId)
      .single()

    if (paymentError || !payment) {
      throw new Error('Payment not found for this order')
    }

    const idComercio = parseInt(Deno.env.get('ZONAPAGOS_ID_COMERCIO') || '0')
    const usuario = Deno.env.get('ZONAPAGOS_USUARIO')
    const clave = Deno.env.get('ZONAPAGOS_CLAVE')

    const zonapagosPayload = {
      "int_id_comercio": idComercio,
      "str_usr_comercio": usuario,
      "str_pwd_Comercio": clave,
      "str_id_pago": payment.str_id_pago,
      "int_no_pago": -1
    }

    const response = await fetch('https://www.zonapagos.com/Apis_CicloPago/api/VerificaciónPago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zonapagosPayload)
    })

    if (!response.ok) {
      throw new Error(`ZonaPagos API responded with status: ${response.status}`)
    }

    const result = await response.json()
    // result example: { int_estado: 1, int_error: 0, str_detalle: null, int_cantidad_pagos: 1, str_res_pago: "..." }

    let paymentStatus: 'pending' | 'processing' | 'approved' | 'rejected' | 'refunded' | 'disputed' = 'pending'

    // Mapping based on documentation in integracionZonaVirtual.MD
    if (result.int_estado === 1) {
      paymentStatus = 'approved'
    } else if ([1000, 1001, 4000, 4003].includes(result.int_estado)) {
      paymentStatus = 'rejected'
    } else if (result.int_estado !== undefined) {
      // Any other status from SONDA that is not 1 or explicit rejection codes
      // can be considered processing or pending
      paymentStatus = 'processing'
    }

    // Update payment
    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        status: paymentStatus,
        callback_response: result,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    if (updatePaymentError) throw updatePaymentError

    // Update order
    // Note: We only move to 'confirmed' if approved. 
    // If rejected, we might want to keep it as 'pending' but with payment_status 'rejected'
    const orderUpdate: any = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    }
    
    if (paymentStatus === 'approved') {
      orderUpdate.status = 'confirmed'
    }

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', orderId)

    if (updateOrderError) throw updateOrderError

    return new Response(JSON.stringify({ success: true, paymentStatus, rawResponse: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
