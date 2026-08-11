import type { SupabaseClient } from '@supabase/supabase-js';
import { canManageStore } from '@/lib/auth/can-manage-store';

/**
 * Verifica que el usuario pueda gestionar el domicilio de un store_order.
 *
 * Quien dispara el domicilio es el vendedor al marcar "Listo Recogida", así que
 * el criterio es el mismo de cualquier acción de tienda: pertenecer a ella o ser
 * admin. Acá solo se resuelve a qué tienda pertenece el pedido.
 */
export async function canManageStoreOrder(
  supabase: SupabaseClient<any>,
  storeOrderId: string,
  userId: string
): Promise<boolean> {
  const { data: storeOrder } = await supabase
    .from('store_orders')
    .select('store_id')
    .eq('id', storeOrderId)
    .single();

  if (!storeOrder) return false;

  return canManageStore(supabase, (storeOrder as any).store_id, userId);
}
