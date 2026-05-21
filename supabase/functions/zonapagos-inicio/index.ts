import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const appUrl = Deno.env.get('ZONAPAGOS_APP_URL') || 'https://mercamesa.app'

    // 3. Armar el JSON EXACTO con la estructura que exige Zonapagos
    const zonapagosPayload = {
      "InformacionPago": {
        "flt_total_con_iva": compraData.total,
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
        { "int_codigo": 110, "str_valor": "0" }
      ]
    }

    const zonapagosResponse = await fetch('https://www.zonapagos.com/Apis_CicloPago/api/InicioPago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zonapagosPayload)
    })

    const result = await zonapagosResponse.json()

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