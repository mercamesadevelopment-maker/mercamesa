import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { OrderStatus } from '@/src/types';
import { Database } from '@/types/database_generated';

type DbOrderStatus = Database['public']['Enums']['order_status'];

/**
 * Regresa un pedido de tienda a un estado por el que ya pasó (casos extremos).
 *
 * Las reglas —observación obligatoria, destino presente en el historial, quién
 * puede hacerlo, pedido no liquidado— las valida `revert_store_order_status` en
 * la base, en la misma transacción que el cambio y su registro en el historial.
 *
 * A diferencia de `updateStoreOrderStatus`, no solicita domicilio a Pibox: una
 * corrección no debe pedir otro mensajero.
 */
export async function revertStoreOrderStatus(
  storeOrderId: string,
  targetStatus: OrderStatus,
  notes: string
): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const { error } = await supabase.rpc('revert_store_order_status', {
    p_store_order_id: storeOrderId,
    // `OrderStatus` del front arrastra valores legacy que no existen en el enum;
    // el destino sale del historial, así que siempre es un valor real de la base.
    p_target_status: targetStatus as DbOrderStatus,
    p_notes: notes,
  });

  if (error) throw new Error(error.message);
}
