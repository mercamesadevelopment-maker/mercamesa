import type { SupabaseClient } from '@supabase/supabase-js';
import { checkTransition } from './status-transitions';

export class StoreOrderStatusError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Avanza el estado de la parte de una tienda y lo deja en el historial.
 *
 * Recibe el cliente de servicio: quien llama ya comprobó que la persona gestiona
 * esa tienda. Si la parte ya está en ese estado no escribe nada, salvo una nota
 * si viene (el historial es donde se audita, por ejemplo un fallo al pedir el
 * domicilio).
 */
export async function changeStoreOrderStatus(
  service: SupabaseClient<any>,
  input: { storeOrderId: string; target: string; notes: string | null; actorId: string }
): Promise<{ changed: boolean }> {
  const { data: parte, error } = await service
    .from('store_orders')
    .select('status')
    .eq('id', input.storeOrderId)
    .maybeSingle();

  if (error) throw error;
  if (!parte) throw new StoreOrderStatusError('No encontramos ese pedido.', 404);

  const check = checkTransition(parte.status, input.target);
  if (check.kind === 'invalid') throw new StoreOrderStatusError(check.reason, 409);

  if (check.kind === 'advance') {
    // El filtro por el estado leído evita pisar un cambio que llegó en medio
    // (otro miembro de la tienda, o el aviso de Pibox).
    const { data: actualizada, error: updateError } = await service
      .from('store_orders')
      .update({ status: input.target })
      .eq('id', input.storeOrderId)
      .eq('status', parte.status)
      .select('id');

    if (updateError) throw updateError;
    if (!actualizada?.length) {
      throw new StoreOrderStatusError('El pedido cambió mientras tanto. Recarga e intenta de nuevo.', 409);
    }
  } else if (!input.notes) {
    return { changed: false };
  }

  const { error: historyError } = await service.from('store_order_status_history').insert({
    store_order_id: input.storeOrderId,
    status: input.target,
    notes: input.notes,
    changed_by: input.actorId,
  });
  if (historyError) throw historyError;

  return { changed: check.kind === 'advance' };
}
