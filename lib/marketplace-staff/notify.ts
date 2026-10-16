import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { createNotification } from '@/lib/notifications/create-notification';
import { marketplaceOfOrder, STAFF_ROLES, type StaffRole } from './actor';

/**
 * Avisa al equipo de la plaza de un pedido (patinadores, logística o ambos).
 *
 * Un fallo acá nunca tumba lo que lo llamó: es un aviso.
 */
export async function notifyMarketplaceStaffOfOrder(
  orderId: string,
  title: string,
  message: string,
  roles: readonly StaffRole[] = STAFF_ROLES
): Promise<void> {
  try {
    const service = createSupabaseServiceClient() as any;

    const marketplaceId = await marketplaceOfOrder(service, orderId);
    if (!marketplaceId) return;

    const { data: equipo } = await service
      .from('marketplace_staff')
      .select('user_id')
      .eq('marketplace_id', marketplaceId)
      .in('role', roles as string[])
      .eq('is_active', true);

    const recipientUserIds = Array.from(new Set<string>((equipo ?? []).map((p: any) => p.user_id)));
    if (recipientUserIds.length === 0) return;

    await createNotification({
      type: 'marketplace_staff_order',
      title,
      message,
      entityType: 'order',
      entityId: orderId,
      recipientUserIds,
    });
  } catch (error) {
    console.error('No se pudo avisar al equipo de la plaza:', error);
  }
}
