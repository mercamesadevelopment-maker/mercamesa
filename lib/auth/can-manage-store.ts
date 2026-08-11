import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verifica que el usuario pueda gestionar una tienda.
 *
 * Las rutas de settings usan has_permission('system-settings', ...), pero las
 * acciones de vendedor (publicar productos, despachar pedidos) las dispara
 * alguien de la tienda, así que el criterio correcto es pertenecer a ella vía
 * store_members, o ser admin.
 *
 * Importante: `store_products` y `catalog_products` tienen RLS deshabilitada,
 * así que en esas rutas esta verificación es el único control de acceso real.
 */
export async function canManageStore(
  supabase: SupabaseClient<any>,
  storeId: string,
  userId: string
): Promise<boolean> {
  const { data: membership } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membership) return true;

  const { data: profile } = await supabase
    .from('profiles')
    .select('roles ( name )')
    .eq('id', userId)
    .single();

  const roleName = (profile as any)?.roles?.name;
  return roleName === 'admin' || roleName === 'superadmin';
}
