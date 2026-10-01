import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { createNotification } from '@/lib/notifications/create-notification';

/**
 * Avisa a los patinadores de la plaza de un pedido.
 *
 * La plaza sale de las tiendas del pedido: todas son de la misma, porque solo
 * así se pueden juntar. Un fallo acá nunca tumba lo que lo llamó: es un aviso.
 */
export async function notifyRunnersOfOrder(orderId: string, title: string, message: string): Promise<void> {
  try {
    const service = createSupabaseServiceClient();

    const { data: parte } = await service
      .from('store_orders')
      .select('stores ( marketplace_id )')
      .eq('order_id', orderId)
      .limit(1)
      .maybeSingle();

    const marketplaceId = (parte as any)?.stores?.marketplace_id;
    if (!marketplaceId) return;

    const { data: patinadores } = await (service as any)
      .from('marketplace_runners')
      .select('user_id')
      .eq('marketplace_id', marketplaceId)
      .eq('is_active', true);

    await createNotification({
      type: 'runner_order',
      title,
      message,
      entityType: 'order',
      entityId: orderId,
      recipientUserIds: (patinadores ?? []).map((p: any) => p.user_id),
    });
  } catch (error) {
    console.error('No se pudo avisar a los patinadores:', error);
  }
}
