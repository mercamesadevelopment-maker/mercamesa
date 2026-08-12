import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

/**
 * Verifica sesión y permiso RBAC de una route handler.
 *
 * Devuelve la respuesta de error lista para retornar, o `null` si puede seguir.
 * `catalog_products` no tiene RLS, así que en sus rutas esta verificación es el
 * único control de acceso: sin ella basta con estar autenticado —aunque sea como
 * comprador— para escribir en el catálogo maestro.
 */
export async function requirePermission(
  supabase: SupabaseClient<any>,
  moduleKey: string,
  action: PermissionAction,
  message = 'No tienes permisos para realizar esta acción'
): Promise<NextResponse | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: allowed } = await supabase.rpc('has_permission', {
    module_key: moduleKey,
    action_name: action,
  });

  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  return null;
}
