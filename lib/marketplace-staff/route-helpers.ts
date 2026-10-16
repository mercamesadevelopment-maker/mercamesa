import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedClient } from '@/lib/supabase/auth-helpers';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { loadStaffActor, StaffError, type StaffActor, type StaffRole } from './actor';

/**
 * Lo común a las rutas de `app/api/runner` y `app/api/logistics`: saber quién
 * pregunta y traducir los errores esperables a su código HTTP. Mismo molde que
 * `withPqrsActor`.
 */
export async function withStaffActor(
  request: Request,
  allowed: readonly StaffRole[],
  handler: (ctx: { service: SupabaseClient<any>; actor: StaffActor }) => Promise<NextResponse>,
  /** Permiso RBAC que además se exige (`role_permissions`), p. ej. `orders:dispatch`. */
  permission?: { module: string; action: string }
): Promise<NextResponse> {
  try {
    const { supabase, user } = await getAuthenticatedClient(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    if (permission) {
      const { data: allowedByRole } = await supabase.rpc('has_permission', {
        module_key: permission.module,
        action_name: permission.action,
      });
      if (!allowedByRole) {
        return NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 });
      }
    }

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const actor = await loadStaffActor(service, user.id, allowed);

    return await handler({ service, actor });
  } catch (error: unknown) {
    if (error instanceof StaffError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[equipo de plaza] error no controlado', error);
    return NextResponse.json(
      { error: 'No pudimos completar la operación. Intenta de nuevo en un momento.' },
      { status: 500 }
    );
  }
}
