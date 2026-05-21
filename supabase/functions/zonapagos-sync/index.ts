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

function mapZonaPagosMethod(code?: string | null) {
  switch (code) {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error('orderId is required');
    }

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL') ?? '';

    const supabaseServiceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    );

    /**
     * Get payment
     */
    const { data: payment, error: paymentError } =
      await supabase
        .from('payments')
        .select('id, str_id_pago, order_id')
        .eq('order_id', orderId)
        .single();

    if (paymentError || !payment) {
      throw new Error(
        'Payment not found for this order'
      );
    }

    /**
     * ZonaPagos credentials
     */
    const idComercio = parseInt(
      Deno.env.get('ZONAPAGOS_ID_COMERCIO') || '0'
    );

    const usuario =
      Deno.env.get('ZONAPAGOS_USUARIO');

    const clave =
      Deno.env.get('ZONAPAGOS_CLAVE');

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
     */
    const response = await fetch(
      'https://www.zonapagos.com/Apis_CicloPago/api/VerificacionPago',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zonapagosPayload),
      }
    );

    if (!response.ok) {
      throw new Error(
        `ZonaPagos API responded with status: ${response.status}`
      );
    }

    const result = await response.json();

    /**
     * Parse str_res_pago
     */
    const responseParts =
      result.str_res_pago
        ?.split('|')
        .map((p: string) => p.trim())
        .filter(Boolean) || [];

    console.log('ZonaPagos responseParts:', responseParts);

    /**
     * IMPORTANT:
     * Validate indexes against official ZonaPagos docs.
     * These indexes are inferred from your sample payload.
     */

    const transactionCodeRaw =
      responseParts[2];

    const paymentMethodCode =
      responseParts[22];

    const bankCode =
      responseParts[23];

    const bankName =
      responseParts[24];

    /**
     * Payment method mapping
     */
    const paymentMethod =
      mapZonaPagosMethod(paymentMethodCode);

    const paymentProviderName =
      bankName && bankName.length > 0
        ? bankName
        : null;

    /**
     * Map payment status
     */
    let paymentStatus: PaymentStatus =
      'pending';

    const transactionCode = parseInt(
      transactionCodeRaw || '-1'
    );

    /**
     * IMPORTANT:
     * Validate these mappings according to ZonaPagos docs
     */

    if (transactionCode === 1) {
      paymentStatus = 'approved';

    } else if (
      [1000, 1001, 4000, 4003].includes(
        transactionCode
      )
    ) {
      paymentStatus = 'rejected';

    } else {
      paymentStatus = 'processing';
    }

    /**
     * Update payment
     */
    const {
      error: updatePaymentError,
    } = await supabase
      .from('payments')
      .update({
        status: paymentStatus,
        payment_method: paymentMethod,
        payment_provider_name:
          paymentProviderName,
        callback_response: result,
        updated_at:
          new Date().toISOString(),
      })
      .eq('order_id', orderId);

    if (updatePaymentError) {
      throw updatePaymentError;
    }

    /**
     * Update order
     */
    const orderUpdate: Record<
      string,
      unknown
    > = {
      payment_status: paymentStatus,
      updated_at:
        new Date().toISOString(),
    };

    if (paymentStatus === 'approved') {
      orderUpdate.status = 'confirmed';
    }

    const {
      error: updateOrderError,
    } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', orderId);

    if (updateOrderError) {
      throw updateOrderError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentStatus,
        paymentMethod,
        paymentProviderName,
        bankCode,
        rawResponse: result,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
        status: 200,
      }
    );

  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
        status: 400,
      }
    );
  }
});