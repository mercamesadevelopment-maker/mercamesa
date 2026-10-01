import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedClient } from '@/lib/supabase/auth-helpers';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { loadBuyerCredit } from '@/lib/pqrs/refunds';

/**
 * El saldo a favor de quien pregunta y sus movimientos.
 *
 * El libro del saldo no tiene políticas: se lee con el cliente de servicio, y
 * siempre por el id de la sesión, nunca por uno que mande el navegador.
 */
export async function GET(request: Request) {
  try {
    const { user } = await getAuthenticatedClient(request);
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const data = await loadBuyerCredit(service, user.id);

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error('[credit] error', error);
    return NextResponse.json({ error: 'No pudimos cargar tu saldo.' }, { status: 500 });
  }
}
