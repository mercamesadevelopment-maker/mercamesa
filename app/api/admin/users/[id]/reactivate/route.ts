import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { getClientIp } from '@/lib/auth/verification-codes';

/**
 * Devuelve el acceso a una cuenta inactiva, antes de que su periodo termine.
 *
 * Mismo permiso que inactivar (`users:delete`): quien puede quitar el acceso es
 * quien puede devolverlo, y así no hay una vía más laxa para deshacer lo que se
 * hizo por la estricta.
 *
 * No borra la fila del historial, la cierra: para qué se inactivó a alguien en
 * marzo sigue siendo la pregunta que se le hace a esta tabla en agosto.
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
      'delete',
      'No tienes permisos para reactivar usuarios'
    );
    if (denied) return denied;

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const service = createSupabaseServiceClient();

    const { data: objetivo } = await service
      .from('profiles')
      .select('id, is_active, anonymized_at')
      .eq('id', id)
      .maybeSingle();

    if (!objetivo) {
      return NextResponse.json({ error: 'El usuario no existe.' }, { status: 404 });
    }

    // Una cuenta anonimizada está inactiva por otra razón, y devolverle el
    // acceso sería deshacer a medias una supresión de datos: el perfil ya no
    // tiene ni nombre ni correo real con los que entrar.
    if (objetivo.anonymized_at) {
      return NextResponse.json(
        { error: 'No se puede reactivar una cuenta cuyos datos fueron suprimidos.' },
        { status: 400 }
      );
    }

    if (objetivo.is_active !== false) {
      return NextResponse.json({ error: 'Esta cuenta ya está activa.' }, { status: 400 });
    }

    await service
      .from('user_deactivations')
      .update({ lifted_at: new Date().toISOString(), lifted_by: actor.id })
      .eq('user_id', id)
      .is('lifted_at', null);

    const { error: perfilError } = await service
      .from('profiles')
      .update({ is_active: true })
      .eq('id', id);

    if (perfilError) {
      console.error('reactivate: no se pudo reactivar el perfil', perfilError);
      return NextResponse.json(
        { error: 'No se pudo reactivar la cuenta. Vuelve a intentarlo.' },
        { status: 500 }
      );
    }

    await service.from('admin_user_actions').insert({
      actor_id: actor.id,
      target_user_id: id,
      action: 'user_reactivated',
      request_ip: getClientIp(request),
    });

    return NextResponse.json({ reactivated: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
