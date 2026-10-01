import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthenticatedClient } from '@/lib/supabase/auth-helpers';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { listActiveBlocks } from '@/lib/stores/buyer-blocks';

/**
 * Los compradores bloqueados en una tienda, para su equipo y para los
 * administradores.
 *
 * La tabla no tiene políticas: se comprueba con la sesión que quien pregunta
 * gestiona la tienda y recién entonces se lee con el cliente de servicio.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { supabase, user } = await getAuthenticatedClient(request);
    if (!supabase || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    if (!(await canManageStore(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const bloqueos = await listActiveBlocks(service, id);

    // Al tendero le basta saber a quién y desde cuándo; el id del comprador no
    // le hace falta.
    const data = bloqueos.map(({ buyerId: _b, ...resto }) => resto);

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error('[buyer-blocks] error', error);
    return NextResponse.json({ error: 'No se pudieron cargar los bloqueos.' }, { status: 500 });
  }
}
