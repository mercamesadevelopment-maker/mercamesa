import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hace lo que haría la confirmación de ZonaPagos, que no puede llegar a
 * `localhost`: registra un pago aprobado y deja el pedido pagado. Lo demás lo
 * hacen los disparadores de siempre (las tiendas pasan a «confirmado», se
 * descuenta el inventario, se encola la factura).
 *
 * Solo para la base local: quien llama ya pasó por `localEnv()`.
 */
export async function payLocalOrder(supabase: SupabaseClient<any>, code: string): Promise<string> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, code, total, credit_applied, payment_status, status, expired_at')
    .eq('code', code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) throw new Error(`No existe el pedido ${code} en la base local.`);
  if (order.payment_status === 'approved') return `El pedido ${code} ya estaba pagado.`;
  if (order.expired_at) throw new Error(`El pedido ${code} ya venció. Crea uno nuevo.`);

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

  return `Pedido ${code} pagado: ${amount.toLocaleString('es-CO')} (simulado).`;
}
