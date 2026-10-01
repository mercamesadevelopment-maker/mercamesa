import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedClient } from '@/lib/supabase/auth-helpers';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { loadPqrsActor, type PqrsActor } from './actor';
import { PqrsInputError } from './errors';

/**
 * Lo común a todas las rutas de `app/api/pqrs`: saber quién pregunta y traducir
 * los errores esperables a su código HTTP.
 *
 * Las tablas de PQRS solo se leen con el cliente de servicio, así que cada ruta
 * autentica primero con la sesión y recién entonces lo crea.
 */
export async function withPqrsActor(
  request: Request,
  handler: (ctx: { service: SupabaseClient<any>; actor: PqrsActor }) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const { user } = await getAuthenticatedClient(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const actor = await loadPqrsActor(service, user.id);

    return await handler({ service, actor });
  } catch (error: unknown) {
    if (error instanceof PqrsInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[pqrs] error no controlado', error);
    return NextResponse.json(
      { error: 'No pudimos completar la operación. Intenta de nuevo en un momento.' },
      { status: 500 }
    );
  }
}
