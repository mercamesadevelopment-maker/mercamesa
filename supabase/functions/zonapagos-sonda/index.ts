import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Protección para el cron
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Obtener pagos pendientes creados hace más de 7 minutos
    const sevenMinutesAgo = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('payments')
      .select('id, str_id_pago, order_id, amount')
      .in('status', ['pending', 'processing'])
      .lt('created_at', sevenMinutesAgo);

    if (fetchError) throw fetchError;
    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending payments to sync' }), { status: 200 });
    }

    const idComercio = parseInt(Deno.env.get('ZONAPAGOS_ID_COMERCIO') || '0');
    const usuario = Deno.env.get('ZONAPAGOS_USUARIO');
    const clave = Deno.env.get('ZONAPAGOS_CLAVE');

    const results = [];

    // 2. Consultar y actualizar cada pago en lote
    for (const payment of pendingPayments) {
      try {
        const payload = {
          int_id_comercio: idComercio,
          str_usr_comercio: usuario,
          str_pwd_Comercio: clave,
          str_id_pago: payment.str_id_pago,
          int_no_pago: -1,
        };

        const response = await fetch(
          'https://www.zonapagos.com/Apis_CicloPago/api/VerificacionPago',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) continue;

        const result = await response.json();
        const responseParts = result.str_res_pago?.split('|').map((p: string) => p.trim()) || [];

        if (responseParts.length === 0) continue;

        // Extraer códigos correspondientes
        const transactionCodeRaw = responseParts[4]; // int_estado_pago (999, 4001, 1, 1000, etc.)
        const paymentMethodCode = responseParts[22];
        const bankName = responseParts[24];
        
        const transactionCode = parseInt(transactionCodeRaw || '-1');

        let paymentStatus = 'pending';
        if (transactionCode === 1) {
          paymentStatus = 'approved';
        } else if ([1000, 1001, 4000, 4003].includes(transactionCode)) {
          paymentStatus = 'rejected';
        } else if (transactionCode !== -1) {
          paymentStatus = 'processing';
        }

        // 3. Actualizar la tabla de pagos
        await supabase
          .from('payments')
          .update({
            status: paymentStatus,
            payment_method: paymentMethodCode === '2701' ? 'pse' : (paymentMethodCode === '1000' ? 'card' : 'unknown'),
            payment_method_label: bankName ? `PSE - ${bankName}` : 'Otro',
            provider_payment_id: responseParts[21] || null, // No. de pago de la pasarela
            callback_response: result,
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.id);

        // 4. Actualizar la orden asociada
        const orderUpdate: any = {
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        };

        if (paymentStatus === 'approved') {
          orderUpdate.status = 'confirmed';
        }

        await supabase
          .from('orders')
          .update(orderUpdate)
          .eq('id', payment.order_id);

        results.push({ orderId: payment.order_id, status: paymentStatus });
      } catch (err) {
        console.error(`Error syncing payment ${payment.str_id_pago}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
