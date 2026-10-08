import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolverPedido, verificarIntento } from '../_shared/zonapagos.ts';

serve(async (req) => {
  try {
    // Protección para el cron. La función se despliega sin verificación de JWT
    // (el cron no tiene sesión); esta clave es su única puerta. La manda
    // `public.call_edge_cron`, que la lee de Vault.
    const cronSecret = req.headers.get('x-cron-secret');
    const expected = Deno.env.get('CRON_SECRET');
    if (!expected || cronSecret !== expected) {
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

    // 2. Consultar cada intento en ZonaPagos y guardar lo que responda
    const orderIds = new Set<string>();

    for (const payment of pendingPayments) {
      try {
        const paymentStatus = await verificarIntento(supabase, payment);
        if (paymentStatus) orderIds.add(payment.order_id);
      } catch (err) {
        console.error(`Error syncing payment ${payment.str_id_pago}:`, err);
      }
    }

    const results = [];

    // 3. Actualizar cada pedido con el resultado de TODOS sus intentos (ver
    // `resolverPedido`): un aprobado siempre gana y el pedido solo queda
    // rechazado cuando no le queda ningún intento por resolver. Así el
    // «rechazado» de un intento no pisa el pedido que otro intento pagó o
    // todavía puede pagar, ni le devuelve al carrito productos ya comprados.
    for (const orderId of orderIds) {
      try {
        const paymentStatus = await resolverPedido(supabase, orderId);

        // 4. Pedido rechazado: sus productos vuelven al carrito. (El carrito de
        // un pedido aprobado lo borra `resolverPedido`.)
        if (paymentStatus === 'rejected') {
          const { data: pendingItems } = await supabase
            .from('cart_items')
            .select('id, buyer_id, store_product_id, quantity')
            .eq('order_id', orderId);

          if (pendingItems) {
            for (const item of pendingItems) {
              const { data: activeItem } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('buyer_id', item.buyer_id)
                .eq('store_product_id', item.store_product_id)
                .eq('status', 'active')
                .maybeSingle();

              if (activeItem) {
                await supabase
                  .from('cart_items')
                  .update({ quantity: activeItem.quantity + item.quantity, updated_at: new Date().toISOString() })
                  .eq('id', activeItem.id);

                await supabase
                  .from('cart_items')
                  .delete()
                  .eq('id', item.id);
              } else {
                await supabase
                  .from('cart_items')
                  .update({ status: 'active', order_id: null, updated_at: new Date().toISOString() })
                  .eq('id', item.id);
              }
            }
          }
        }

        results.push({ orderId, status: paymentStatus });
      } catch (err) {
        console.error(`Error resolving order ${orderId}:`, err);
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
