import type { SupabaseClient } from '@supabase/supabase-js';

/** A quién se le avisa: el equipo de una tienda o los administradores. Con el cliente de servicio. */

export async function storeTeamIds(service: SupabaseClient<any>, storeId: string | null): Promise<string[]> {
  if (!storeId) return [];
  const { data } = await service.from('store_members').select('user_id').eq('store_id', storeId);
  return (data ?? []).map((m: any) => m.user_id);
}

export async function activeAdminIds(service: SupabaseClient<any>): Promise<string[]> {
  const { data } = await service
    .from('profiles')
    .select('id, roles!inner ( name )')
    .in('roles.name', ['admin', 'superadmin'])
    .eq('is_active', true);
  return (data ?? []).map((p: any) => p.id);
}
