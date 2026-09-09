import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}

/**
 * Cierra las sesiones de un usuario en todos sus dispositivos.
 *
 * `auth.admin.signOut(jwt)` necesita el token del usuario, que el administrador
 * no tiene; por eso se pasa por el RPC `admin_revoke_user_sessions`, que borra
 * de `auth.sessions` con SECURITY DEFINER y revalida el permiso por dentro.
 *
 * Alcance real: revoca sesiones y tokens de refresco, pero el access token ya
 * emitido vive hasta expirar (1 hora por defecto). Por eso la respuesta insiste
 * en restablecer también la contraseña.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'users',
      'update',
      'No tienes permisos para cerrar las sesiones de este usuario'
    );
    if (denied) return denied;

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // El RPC corre con la sesión del administrador a propósito: revalida
    // `has_permission` por dentro, así que no depende de esta ruta.
    const { data: revoked, error } = await supabase.rpc('admin_revoke_user_sessions', {
      p_user_id: id,
    });

    if (error) {
      console.error('revoke-sessions: rpc failed', error);
      return NextResponse.json({ error: 'No se pudieron cerrar las sesiones.' }, { status: 500 });
    }

    const service = createSupabaseServiceClient();
    await service.from('admin_user_actions').insert({
      actor_id: actor.id,
      target_user_id: id,
      action: 'sessions_revoked',
      request_ip: getClientIp(request),
    });

    return NextResponse.json({ revoked: revoked ?? 0 }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
