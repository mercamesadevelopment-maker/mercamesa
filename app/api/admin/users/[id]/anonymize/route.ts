import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { getClientIp } from '@/lib/auth/verification-codes';
import { anonymizeAccount } from '@/lib/accounts/anonymize-account';

/**
 * Atiende una solicitud de supresión de datos personales. Lo que se suprime y lo
 * que se conserva está en `lib/accounts/anonymize-account.ts`, que comparte con
 * el cierre por inactividad.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // `delete` y no `update`: esto suprime datos y no tiene vuelta atrás. Solo
    // el superadmin tiene esa acción sobre el módulo de usuarios.
    const denied = await requirePermission(
      supabase,
      'users',
      'delete',
      'No tienes permisos para suprimir los datos de un usuario'
    );
    if (denied) return denied;

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const service = createSupabaseServiceClient();
    const result = await anonymizeAccount(service, id);
    if ('message' in result) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    await service.from('admin_user_actions').insert({
      actor_id: actor.id,
      target_user_id: id,
      action: 'data_anonymized',
      request_ip: getClientIp(request),
    });

    return NextResponse.json({ anonymized: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
