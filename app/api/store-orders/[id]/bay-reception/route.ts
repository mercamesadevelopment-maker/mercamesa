import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { getBayReception } from '@/lib/logistics/bay-reception';

/**
 * Cómo recibió logística esta parte en la bahía: fotos, observación y si algo
 * llegó en mal estado. La ven el equipo de la tienda de la parte y los admins;
 * el comprador no. `data: null` si no pasó por logística.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    if (!(await canManageStoreOrder(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre este pedido.' }, { status: 403 });
    }

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    return NextResponse.json({ data: await getBayReception(service, id) }, { status: 200 });
  } catch (error: unknown) {
    console.error('[store-orders/bay-reception] error no controlado', error);
    return NextResponse.json({ error: 'No pudimos cargar la recepción en la bahía.' }, { status: 500 });
  }
}
