import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { changeStoreOrderStatus, StoreOrderStatusError } from '@/lib/orders/change-store-order-status';

const NOTES_MAX = 500;

/**
 * El botón del pedido en el panel de la tienda y del admin: avanza la parte al
 * siguiente estado (ver `lib/orders/status-transitions.ts`) y lo deja en el
 * historial.
 *
 * Antes lo escribía el navegador directo en la base, y la base no tenía cómo
 * impedir que alguien cambiara el pedido de otra tienda. Pedir el mensajero al
 * quedar «Listo Recogida» sigue siendo una llamada aparte a `/api/pibox/bookings`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json().catch(() => ({}));
    const target = typeof body.status === 'string' ? body.status : '';
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, NOTES_MAX) : null;
    if (!target) return NextResponse.json({ error: 'Falta el estado.' }, { status: 400 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const data = await changeStoreOrderStatus(service, { storeOrderId: id, target, notes, actorId: user.id });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof StoreOrderStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('store-orders/status:', error);
    return NextResponse.json({ error: 'No se pudo cambiar el estado del pedido.' }, { status: 500 });
  }
}
