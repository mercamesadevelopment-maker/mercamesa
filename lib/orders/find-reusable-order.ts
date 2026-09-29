import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * El pedido pendiente que el comprador ya tiene con exactamente este carrito, si
 * lo hay.
 *
 * Cada «Confirmar y pagar» creaba un pedido nuevo: la clave de idempotencia se
 * genera por clic, así que un comprador al que la pasarela no le cargó y volvió
 * a intentar dejaba un pedido más cada vez (una compradora dejó 6 en cuatro
 * minutos, y la tienda veía los 6 como «Pendiente de Pago»). Ahora el reintento
 * cae en el mismo pedido y solo abre un intento de pago nuevo.
 *
 * Tiene que coincidir todo: tienda, dirección, productos, cantidades y notas. Si
 * algo cambió es otro pedido; el anterior no se cancela acá porque su primer
 * pago podría estar entrando en la pasarela, y se deja al vencimiento
 * (`public.expire_unpaid_orders`).
 */
export interface ReusableOrderInput {
  buyerId: string;
  storeId: string;
  deliveryAddressId: string;
  items: { store_product_id: string; quantity: number; notes?: string | null }[];
}

export async function findReusableOrderId(
  supabase: SupabaseClient,
  input: ReusableOrderInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, payable_until, order_items ( store_product_id, quantity, notes ), store_orders ( store_id )')
    .eq('buyer_id', input.buyerId)
    .eq('delivery_address_id', input.deliveryAddressId)
    .eq('status', 'pending')
    .is('client_id', null)
    .is('expired_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  // Si no se puede consultar, se crea un pedido nuevo: un duplicado es mejor
  // que dejar al comprador sin poder pagar.
  if (error || !data) return null;

  const firma = firmaDeItems(input.items);
  const ahora = Date.now();

  const reusable = (data as any[]).find(
    (o) =>
      o.payable_until &&
      new Date(o.payable_until).getTime() > ahora &&
      (o.store_orders ?? []).length === 1 &&
      String(o.store_orders[0].store_id) === String(input.storeId) &&
      firmaDeItems(o.order_items ?? []) === firma
  );

  return reusable?.id ?? null;
}

/** Los ítems como texto comparable, sin depender del orden en que llegan. */
function firmaDeItems(items: ReusableOrderInput['items']): string {
  return items
    .map((i) => `${i.store_product_id}|${Number(i.quantity)}|${(i.notes ?? '').trim()}`)
    .sort()
    .join('\n');
}
