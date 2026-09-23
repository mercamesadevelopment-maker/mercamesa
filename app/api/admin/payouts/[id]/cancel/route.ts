import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Cancela un borrador y libera sus pedidos.
 *
 * Solo borradores: una liquidación aprobada ya tiene un archivo que pudo
 * subirse al banco, y "cancelarla" acá no devolvería el dinero — solo haría que
 * el sistema crea que no se pagó y lo vuelva a incluir en la siguiente.
 *
 * Los ítems SE BORRAN, y eso es lo que devuelve los pedidos a la bolsa: la
 * elegibilidad se apoya en que no exista un `payout_item` para ese pedido. La
 * fila de `payouts` se conserva con sus totales, para que quede el rastro de que
 * hubo un borrador y se descartó.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'payouts',
      'delete',
      'No tienes permisos para cancelar dispersiones'
    );
    if (denied) return denied;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const notes = String(body.notes ?? '').trim();

    const service = createSupabaseServiceClient();

    const { data: payout } = await service
      .from('payouts')
      .select('id, status, notes')
      .eq('id', id)
      .maybeSingle();

    if (!payout) {
      return NextResponse.json({ error: 'La liquidación no existe.' }, { status: 404 });
    }

    if (payout.status !== 'draft') {
      return NextResponse.json(
        {
          error:
            payout.status === 'approved'
              ? 'Esta liquidación ya está aprobada y su archivo pudo haberse subido al banco. Cancelarla acá no devolvería el dinero.'
              : 'Esta liquidación ya está cancelada.',
        },
        { status: 409 }
      );
    }

    const { error: itemsError } = await service.from('payout_items').delete().eq('payout_id', id);

    if (itemsError) {
      console.error('payouts/cancel: no se pudieron liberar los pedidos', itemsError);
      return NextResponse.json(
        { error: 'No se pudo cancelar. No se modificó nada.' },
        { status: 500 }
      );
    }

    await service
      .from('payouts')
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        notes: notes || payout.notes,
      })
      .eq('id', id);

    return NextResponse.json({ cancelled: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
