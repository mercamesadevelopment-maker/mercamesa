import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');

    if (!storeId) {
      return NextResponse.json({ error: 'store_id es requerido' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: storeOrder, error: storeOrderError } = await supabase
      .from('store_orders')
      .select('id, orders!inner(buyer_id)')
      .eq('order_id', id)
      .eq('store_id', storeId)
      .eq('orders.buyer_id', user.id)
      .single();

    if (storeOrderError || !storeOrder) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const { data: history, error: historyError } = await supabase
      .from('store_order_status_history')
      .select('id, status, notes, created_at, profiles:changed_by ( full_name )')
      .eq('store_order_id', storeOrder.id)
      .order('created_at', { ascending: true });

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 400 });
    }

    const data = (history || []).map((h: any) => ({
      id: h.id,
      status: h.status,
      notes: h.notes,
      createdAt: h.created_at,
      changedByName: h.profiles?.full_name || null,
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
