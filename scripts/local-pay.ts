/**
 * scripts/local-pay.ts
 *
 * Aprueba el pago de un pedido en la base LOCAL, sin pasarela.
 *
 * ZonaPagos confirma un pago llamando de vuelta a la aplicación, y a
 * `localhost` no puede llegar. Este script hace lo que haría esa confirmación:
 * registra un pago aprobado y deja el pedido pagado. Lo demás lo hacen los
 * mismos disparadores de siempre (las tiendas pasan a «confirmado», se descuenta
 * el inventario, se encola la factura).
 *
 * Uso:
 *   pnpm local:pay MM-2026-001082
 *
 * Solo corre contra la base local: si la URL de Supabase no es de esta máquina,
 * se niega. Aprobar un pago a mano en producción es regalar un pedido.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const HOSTS_LOCALES = ['127.0.0.1', 'localhost'];

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Falta el código del pedido. Ejemplo: pnpm local:pay MM-2026-001082');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('No se encontró .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  if (!HOSTS_LOCALES.includes(new URL(url).hostname)) {
    console.error(`Este script solo corre contra la base local, y la URL configurada es ${new URL(url).host}.`);
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, code, total, credit_applied, payment_status, status, expired_at')
    .eq('code', code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) {
    console.error(`No existe el pedido ${code} en la base local.`);
    process.exit(1);
  }
  if (order.payment_status === 'approved') {
    console.log(`El pedido ${code} ya estaba pagado.`);
    return;
  }
  if (order.expired_at) {
    console.error(`El pedido ${code} ya venció. Crea uno nuevo.`);
    process.exit(1);
  }

  // Lo que faltaba por pagar: el saldo a favor apartado ya cubrió su parte.
  const amount = Number(order.total) - Number(order.credit_applied ?? 0);

  const { error: paymentError } = await supabase.from('payments').insert({
    order_id: order.id,
    provider: 'local',
    str_id_pago: `local-${order.id}-${Date.now()}`,
    status: 'approved',
    amount,
    payment_method: 'local',
    payment_method_label: 'Pago simulado (local)',
  });
  if (paymentError) throw new Error(`No se pudo registrar el pago: ${paymentError.message}`);

  const { error: orderError } = await supabase
    .from('orders')
    .update({ payment_status: 'approved', status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', order.id);
  if (orderError) throw new Error(`No se pudo aprobar el pedido: ${orderError.message}`);

  // Como al aprobarse un pago de verdad: lo comprado sale del carrito.
  await supabase.from('cart_items').delete().eq('order_id', order.id);

  console.log(`Pedido ${code} pagado: ${amount.toLocaleString('es-CO')} (simulado).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
