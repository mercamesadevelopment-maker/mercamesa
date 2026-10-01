import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedClient } from '@/lib/supabase/auth-helpers';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { loadRunnerActor, RunnerError, type RunnerActor } from './actor';

/**
 * Lo común a las rutas de `app/api/runner`: saber quién pregunta y traducir los
 * errores esperables a su código HTTP. Mismo molde que `withPqrsActor`.
 */
export async function withRunnerActor(
  request: Request,
  handler: (ctx: { service: SupabaseClient<any>; actor: RunnerActor }) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const { user } = await getAuthenticatedClient(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const actor = await loadRunnerActor(service, user.id);

    return await handler({ service, actor });
  } catch (error: unknown) {
    if (error instanceof RunnerError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[runner] error no controlado', error);
    return NextResponse.json(
      { error: 'No pudimos completar la operación. Intenta de nuevo en un momento.' },
      { status: 500 }
    );
  }
}
