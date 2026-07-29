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
      .single();

    if (idempotencyError && idempotencyError.code !== 'PGRST116') {
      return NextResponse.json({ error: idempotencyError.message }, { status: 400 });
    }

    if (existingOrder) {
      return NextResponse.json({ data: existingOrder, idempotent: true }, { status: 200 });
    }

    // --- SECURE PRICE VALIDATION & RE-CALCULATION ON SERVER SIDE ---
    // 1. Check buyer type (retail vs wholesale) securely from the database
    let isWS = false;
    const buyerIdToCheck = order.buyer_id || user.id;
    if (buyerIdToCheck) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('buyer_type')
        .eq('id', buyerIdToCheck)
        .single();
      isWS = profile?.buyer_type === 'wholesale';
    }

    // 2. Query actual prices for all items in the request
    const productIds = items.map(item => item.store_product_id);
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'El pedido debe contener al menos un producto' }, { status: 400 });
    }

    const { data: dbProducts, error: dbProductsError } = await supabase
      .from('store_products')
      .select(`
        id,
        price_per_unit,
        wholesale_price,
        store_id,
        catalog_products ( name ),
        measurement_units ( abbreviation )
      `)
      .in('id', productIds);

    if (dbProductsError || !dbProducts) {
      return NextResponse.json({ error: dbProductsError?.message || 'Error al verificar los productos' }, { status: 400 });
    }

    if (dbProducts.length !== productIds.length) {
      return NextResponse.json({ error: 'Uno o más productos del pedido no son válidos' }, { status: 400 });
    }

    // 3. Recalculate subtotal and reconstruct items securely using database prices
    let recalculatedSubtotal = 0;
    const recalculatedItems = items.map(item => {
      const dbProd = (dbProducts as any[]).find(p => p.id === item.store_product_id);
      if (!dbProd) {
        throw new Error('Producto no encontrado en base de datos');
      }

      // Determine unit price securely from database values
      const unitPrice = isWS 
        ? (dbProd.wholesale_price || dbProd.price_per_unit || 0) 
        : (dbProd.price_per_unit || 0);

      const totalPrice = unitPrice * item.quantity;
      recalculatedSubtotal += totalPrice;

      return {
        store_product_id: item.store_product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        catalog_name: dbProd.catalog_products?.name || item.catalog_name,
        unit_name: dbProd.measurement_units?.abbreviation || item.unit_name,
        notes: item.notes || null,
      };
    });

    // 4. Recalculate subtotal for each store order
    const deliveryFeePerStore = 5000;
    const recalculatedStoreOrders = storeOrders.map(so => {
      // Find items belonging to this store
      const storeItems = recalculatedItems.filter(item => {
        const dbProd = (dbProducts as any[]).find(p => p.id === item.store_product_id);
        return dbProd && String(dbProd.store_id || '') === String(so.store_id);
      });

      const storeSubtotal = storeItems.reduce((sum, item) => sum + item.total_price, 0);

      return {
        ...so,
        subtotal: storeSubtotal,
      };
    });

    const totalDeliveryFee = order.delivery_fee !== undefined ? Number(order.delivery_fee) : (deliveryFeePerStore * storeOrders.length);
    const recalculatedTotal = recalculatedSubtotal + totalDeliveryFee;

    // --- END SECURE RE-CALCULATION ---

    const orderInsertData: any = {
      buyer_id: order.buyer_id || null,
      client_id: (order as any).client_id || null,
      buyer_type: isWS ? 'wholesale' : 'retail',
      status: order.status,
      payment_status: order.payment_status,
      subtotal: recalculatedSubtotal,
      delivery_fee: totalDeliveryFee,
      discount: 0,
      total: recalculatedTotal,
      notes: order.notes,
      delivery_address_id: order.delivery_address_id,
      client_idempotency_key: order.client_idempotency_key,
    };

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderInsertData)
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    if (recalculatedItems.length > 0) {
      const itemsWithOrderId = recalculatedItems.map(item => ({
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

    if (recalculatedStoreOrders.length > 0) {
      const storeOrdersWithOrderId = recalculatedStoreOrders.map(so => ({
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
