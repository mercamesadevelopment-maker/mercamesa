import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { cancelStorePart, CancelPartError } from '@/lib/orders/cancel-store-part';

/**
 * La tienda no puede cumplir su parte de un pedido de varias tiendas.
 *
 * Cancela esa parte y le abona al comprador su valor como saldo a favor. Se
 * puede volver a llamar: si la devolución falló la primera vez, el reintento la
 * completa sin cancelar ni abonar dos veces.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;

    // El equipo de la tienda o un administrador: el mismo criterio de cualquier
    // acción sobre un pedido de tienda.
    if (!(await canManageStoreOrder(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre este pedido.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    const data = await cancelStorePart(service, {
      storeOrderId: id,
      actorId: user.id,
      reason: typeof body.reason === 'string' ? body.reason : '',
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof CancelPartError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[store-orders/cancel] error no controlado', error);
    return NextResponse.json(
      { error: 'No pudimos cancelar esta parte del pedido. Intenta de nuevo en un momento.' },
      { status: 500 }
    );
  }
}
