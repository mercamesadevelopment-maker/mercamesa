import type { SupabaseClient } from '@supabase/supabase-js';
import { storeTeamIds } from '@/lib/notifications/recipients';
import { marketplaceOfOrder } from '@/lib/marketplace-staff/actor';
import type { Recipient, RolDestinatario } from './rules';

export type PickupRecipient = Recipient & { id: string; rol: Exclude<RolDestinatario, 'comprador'> };

const PROFILE_COLUMNS = 'id, full_name, phone, phone_verified_at, whatsapp_notifications, is_active';

/**
 * Quienes reciben el código de recogida de un pedido: el equipo de las tiendas
 * (`storeIds`) o el de la plaza con ese rol. Sin filtrar todavía por teléfono
 * verificado: eso lo decide `skipReason`, igual que con el comprador.
 */
export async function pickupRecipients(
  service: SupabaseClient<any>,
  rol: Exclude<RolDestinatario, 'comprador'>,
  orderId: string,
  storeIds: string[]
): Promise<PickupRecipient[]> {
  let userIds: string[];

  if (rol === 'tendero') {
    userIds = (await Promise.all(storeIds.map((id) => storeTeamIds(service, id)))).flat();
  } else {
    const marketplaceId = await marketplaceOfOrder(service, orderId);
    if (!marketplaceId) return [];
    const { data, error } = await service
      .from('marketplace_staff')
      .select('user_id')
      .eq('marketplace_id', marketplaceId)
      .eq('role', rol === 'logistica' ? 'logistics' : 'runner')
      .eq('is_active', true);
    if (error) throw new Error(`No se pudo leer el equipo de la plaza: ${error.message}`);
    userIds = (data ?? []).map((s: any) => s.user_id);
  }

  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];

  const { data, error } = await service.from('profiles').select(PROFILE_COLUMNS).in('id', unique);
  if (error) throw new Error(`No se pudieron leer los destinatarios: ${error.message}`);
  return (data ?? []).map((p: any) => ({ ...(p as Recipient), id: p.id, rol }));
}
