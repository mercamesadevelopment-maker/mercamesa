import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolverPedido, verificarIntentosAbiertos } from '../_shared/zonapagos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

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
     * Se consultan TODOS los intentos sin resolver del pedido, no solo el
     * último: el comprador puede volver de la pasarela por un intento rechazado
     * mientras otro anterior, que sí pagó, sigue esperando al banco.
     */
    await verificarIntentosAbiertos(supabase, orderId);

    // Lo que ve el comprador es el estado del pedido, no el de un intento.
    const paymentStatus = await resolverPedido(supabase, orderId);

    if (!paymentStatus) {
      throw new Error(`Payment not found for order ${orderId}: No record`);
    }

    return new Response(
      JSON.stringify({ success: true, paymentStatus }),
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
