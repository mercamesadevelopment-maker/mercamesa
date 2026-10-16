import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { PACKING_NOTES_MAX, packingNotesEditable } from '@/lib/orders/packing-notes';

/**
 * Cómo va empacada la parte de una tienda: «2 bolsas, fríos en la azul».
 *
 * La escribe el equipo de la tienda (o un admin) mientras la parte sigue en el
 * local. La leen el patinador, logística y el domiciliario (va en la indicación
 * del paquete de Pibox).
 *
 * Con el cliente de servicio porque `store_orders` no tiene RLS: el permiso se
 * comprueba acá.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const notas = typeof body.packingNotes === 'string' ? body.packingNotes.trim() : '';
    if (notas.length > PACKING_NOTES_MAX) {
      return NextResponse.json(
        { error: `Escribe máximo ${PACKING_NOTES_MAX} caracteres.` },
        { status: 400 }
      );
    }

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const { data: parte } = await service
      .from('store_orders')
      .select('status, collected_at, bay_received_at')
      .eq('id', id)
      .maybeSingle();

    if (!parte) return NextResponse.json({ error: 'No encontramos ese pedido.' }, { status: 404 });

    if (
      !packingNotesEditable({
        status: parte.status,
        collectedAt: parte.collected_at,
        bayReceivedAt: parte.bay_received_at,
      })
    ) {
      return NextResponse.json(
        { error: 'Tu parte ya salió de la tienda: ya no se puede cambiar cómo va empacada.' },
        { status: 409 }
      );
    }

    const { error } = await service
      .from('store_orders')
      .update({ packing_notes: notas || null })
      .eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ data: { packingNotes: notas || null } }, { status: 200 });
  } catch (error: unknown) {
    console.error('[store-orders/packing-notes] error no controlado', error);
    return NextResponse.json(
      { error: 'No pudimos guardar las notas de empaque. Intenta de nuevo en un momento.' },
      { status: 500 }
    );
  }
}
