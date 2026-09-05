import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { compraData } = await req.json()

    const idComercio = parseInt(Deno.env.get('ZONAPAGOS_ID_COMERCIO') || '0')
    const usuario = Deno.env.get('ZONAPAGOS_USUARIO')
    const clave = Deno.env.get('ZONAPAGOS_CLAVE')
    const codigoServicio = Deno.env.get('ZONAPAGOS_CODIGO_SERVICIO')
    const appUrl = Deno.env.get('ZONAPAGOS_APP_URL') || 'https://mercamesa.vercel.app/'
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // El monto se lee de la orden, NO del cuerpo de la petición.
    //
    // Antes se cobraba `compraData.total`, que venía del navegador y no se
    // contrastaba contra nada: una petición armada a mano podía pagar $1 por un
    // pedido de $70.000. Es el mismo chequeo que ya hace `zonapagos-pago-token`.
    if (!compraData?.orderId) {
      throw new Error('orderId es requerido')
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await callerClient.auth.getUser()

    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total')
      .eq('id', compraData.orderId)
      .eq('buyer_id', user.id)
      .single()

    if (orderError || !order) {
      throw new Error('Orden no encontrada')
    }

    const amountToCharge = Number(order.total)

    // 3. Armar el JSON EXACTO con la estructura que exige Zonapagos
    const zonapagosPayload = {
      "InformacionPago": {
        "flt_total_con_iva": amountToCharge,
        "flt_valor_iva": compraData.iva || 0,
        "str_id_pago": compraData.idPago,
        "str_descripcion_pago": compraData.descripcion,
        "str_email": compraData.email,
        "str_id_cliente": compraData.idCliente,
        "str_tipo_id": compraData.tipoIdCliente,
        "str_nombre_cliente": compraData.nombreCliente,
        "str_apellido_cliente": compraData.apellidoCliente,
        "str_telefono_cliente": compraData.telefonoCliente,
        "str_opcional1": compraData.orderId || '',
        "str_opcional2": '',
        "str_opcional3": '',
        "str_opcional4": '',
        "str_opcional5": ''
      },
      "InformacionSeguridad": {
        "int_id_comercio": idComercio,
        "str_usuario": usuario,
        "str_clave": clave,
        "int_modalidad": 1
      },
      "AdicionalesPago": [
        { "int_codigo": 111, "str_valor": "0" },
        { "int_codigo": 112, "str_valor": "0" }
      ],
      "AdicionalesConfiguracion": [
        { "int_codigo": 50,  "str_valor": codigoServicio },
        { "int_codigo": 100, "str_valor": "1" },
        { "int_codigo": 101, "str_valor": "1" },
        { "int_codigo": 102, "str_valor": "1" },
        { "int_codigo": 103, "str_valor": "0" },
        { "int_codigo": 104, "str_valor": `${appUrl}/orders/payment-status?order_id=${compraData.orderId}` },
        { "int_codigo": 105, "str_valor": "10000" },
        { "int_codigo": 106, "str_valor": "3" },
        { "int_codigo": 107, "str_valor": "0" },
        { "int_codigo": 108, "str_valor": "1" },
        { "int_codigo": 109, "str_valor": "1" },
        { "int_codigo": 110, "str_valor": "0" },
        ...(compraData.guardarTarjeta ? [{ "int_codigo": 200, "str_valor": "1" }] : [])
      ]
    }

    const zonapagosResponse = await fetch('https://www.zonapagos.com/Apis_CicloPago/api/InicioPago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zonapagosPayload)
    })

    const result = await zonapagosResponse.json()

    // If payment initiation was successful, create the payment record
    const paymentUrl = result?.str_url || result?.url_pago || result?.str_url_pago;
    
    if (paymentUrl && compraData.orderId) {
      const { error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: compraData.orderId,
          provider: 'zonapagos',
          str_id_pago: compraData.idPago,
          status: 'pending',
          amount: amountToCharge,
          payment_url: paymentUrl,
        });
      
      if (insertError) {
        console.error('Error inserting payment record:', insertError);
        // We don't throw here to not block the user from paying, 
        // but it's important to log it.
      }
    }

    return new Response(JSON.stringify(result), {
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
