import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'refunded'
  | 'disputed';

/**
 * Traduce el código de medio de pago que devuelve ZonaPagos en la posición 22 de
 * `str_res_pago`.
 *
 * `1001` es el que manda producción de verdad. Se verificó contra los dos únicos
 * pagos que llegaron a una entidad financiera: uno por Nequi (entidad 1507) y
 * uno por BBVA (entidad 1013), ambos con código 1001. El `2701` que aparece en
 * la documentación nunca se ha visto, así que se conserva por compatibilidad
 * pero no es el que llega.
 *
 * Sin esta traducción los 13 pagos históricos quedaron todos en 'unknown', que
 * en Siigo cae en "Clientes Nacionales" (una cuenta por cobrar) en vez del medio
 * real.
 */
function mapZonaPagosMethod(code?: string | null) {
  switch (code) {
    case '1001':
    case '2701':
      return 'pse';
    case '1000':
      return 'card';
    case '3000':
      return 'cash';
    default:
      return 'unknown';
  }
}

/**
 * `entityName` es la posición 24: el banco o la billetera con la que se pagó
 * (NEQUI, BANCO BBVA COLOMBIA S.A....). Se muestra junto al medio porque es lo
 * que el comprador reconoce de su extracto.
 */
function getPaymentMethodLabel(method: string, entityName?: string | null) {
  switch (method) {
    case 'pse':
      return entityName ? `PSE - ${entityName}` : 'PSE';
    case 'card':
      return 'Tarjeta de Crédito/Débito';
    case 'cash':
      return 'Efectivo';
    default:
      return entityName || 'Otro';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error('orderId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    /**
     * Get payment
     */
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, str_id_pago, order_id')
      .eq('order_id', orderId)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found for order ${orderId}: ${paymentError?.message || 'No record'}`);
    }

    /**
     * ZonaPagos credentials
     */
    const idComercio = parseInt(Deno.env.get('ZONAPAGOS_ID_COMERCIO') || '0');
    const usuario = Deno.env.get('ZONAPAGOS_USUARIO');
    const clave = Deno.env.get('ZONAPAGOS_CLAVE');

    /**
     * Payload
     */
    const zonapagosPayload = {
      int_id_comercio: idComercio,
      str_usr_comercio: usuario,
      str_pwd_Comercio: clave,
      str_id_pago: payment.str_id_pago,
      int_no_pago: -1,
    };

    /**
     * Call ZonaPagos
     * Documentation says "VerificaciónPago" (with accent), but we try both if needed.
     * We'll use the one from the documentation.
     */
    const response = await fetch(
      'https://www.zonapagos.com/Apis_CicloPago/api/VerificacionPago',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zonapagosPayload),
      }
    );

    if (!response.ok) {
      throw new Error(`ZonaPagos API responded with status: ${response.status}`);
    }

    const result = await response.json();

    /**
     * Parse str_res_pago
     * The response is pipe-separated. IMPORTANT: Do NOT use .filter(Boolean) 
     * as it shifts positional indexes when there are empty values.
     */
    const responseParts = result.str_res_pago
      ?.split('|')
      .map((p: string) => p.trim()) || [];

    console.log('ZonaPagos responseParts count:', responseParts.length);

    // Posiciones verificadas contra respuestas reales de producción:
    //  4: código de estado de la transacción (1 = aprobada)
    // 21: número de pago de la pasarela
    // 22: código del medio de pago (1001 = PSE)
    // 23: código de la entidad financiera (1507 = Nequi, 1013 = BBVA)
    // 24: nombre de la entidad (NEQUI, BANCO BBVA COLOMBIA S.A.)
    const transactionCodeRaw = responseParts[4];
    const paymentMethodCode = responseParts[22];
    const entityName = responseParts[24];

    /**
     * Payment method mapping
     */
    const paymentMethod = mapZonaPagosMethod(paymentMethodCode);
    const paymentMethodLabel = getPaymentMethodLabel(paymentMethod, entityName);

    /**
     * Map payment status
     */
    let paymentStatus: PaymentStatus = 'pending';
    const transactionCode = parseInt(transactionCodeRaw || '-1');

    if (transactionCode === 1) {
      paymentStatus = 'approved';
    } else if ([1000, 1001, 4000, 4003].includes(transactionCode)) {
      paymentStatus = 'rejected';
    } else if (transactionCode !== -1) {
      paymentStatus = 'processing';
    }

    /**
     * Update payment
     */
    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        status: paymentStatus,
        payment_method: paymentMethod,
        payment_method_label: paymentMethodLabel,
        provider_payment_id: responseParts[21] || null, // Based on sample: 8812100013
        callback_response: result,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    if (updatePaymentError) throw new Error(`Update payment error: ${updatePaymentError.message}`);

    /**
     * Update order
     */
    const orderUpdate: any = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (paymentStatus === 'approved') {
      orderUpdate.status = 'confirmed';
    }

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', orderId);

    if (updateOrderError) throw new Error(`Update order error: ${updateOrderError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        paymentStatus,
        paymentMethod,
        paymentMethodLabel,
        entityName,
        rawResponse: result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Zonapagos Sync Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || String(error) || 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
