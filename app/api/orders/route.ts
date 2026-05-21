import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { CreateOrderPayload } from '@/src/features/payment/types/payment.types';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const buyerId = searchParams.get('buyer_id');

  let query = supabase.from('orders').select(`
    *,
    order_items (*)
  `);

  if (buyerId) {
    query = query.eq('buyer_id', buyerId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateOrderPayload = await request.json();
    const { order, items, storeOrders } = body;

    if (!order.client_idempotency_key) {
      return NextResponse.json({ error: 'client_idempotency_key is required' }, { status: 400 });
    }

    const { data: existingOrder, error: idempotencyError } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq('client_idempotency_key', order.client_idempotency_key)
      .eq('buyer_id', user.id)
      .single();

    if (idempotencyError && idempotencyError.code !== 'PGRST116') {
      return NextResponse.json({ error: idempotencyError.message }, { status: 400 });
    }

    if (existingOrder) {
      return NextResponse.json({ data: existingOrder, idempotent: true }, { status: 200 });
    }

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: order.buyer_id,
        buyer_type: order.buyer_type,
        status: order.status,
        payment_status: order.payment_status,
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        discount: order.discount,
        total: order.total,
        notes: order.notes,
        delivery_address_id: order.delivery_address_id,
        client_idempotency_key: order.client_idempotency_key,
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    if (items.length > 0) {
      const itemsWithOrderId = items.map(item => ({
        ...item,
        order_id: newOrder.id,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsWithOrderId);

      if (itemsError) {
        await supabase.from('orders').delete().eq('id', newOrder.id);
        return NextResponse.json({ error: itemsError.message }, { status: 400 });
      }
    }

    if (storeOrders.length > 0) {
      const storeOrdersWithOrderId = storeOrders.map(so => ({
        ...so,
        order_id: newOrder.id,
      }));

      const { error: storeOrdersError } = await supabase
        .from('store_orders')
        .insert(storeOrdersWithOrderId);

      if (storeOrdersError) {
        await supabase.from('orders').delete().eq('id', newOrder.id);
        return NextResponse.json({ error: storeOrdersError.message }, { status: 400 });
      }
    }

    const { data: fullOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq('id', newOrder.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ data: newOrder, idempotent: false }, { status: 201 });
    }

    return NextResponse.json({ data: fullOrder, idempotent: false }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
