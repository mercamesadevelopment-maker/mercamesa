import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { CreateOrderPayload } from '@/src/features/payment/types/payment.types';
import { computeOrderPricing } from '@/lib/pricing/compute-order-pricing';
import { loadPricingSettings, PricingConfigError } from '@/lib/pricing/settings';
import {
  quoteDeliveryFee,
  DeliveryQuoteUnavailableError,
} from '@/lib/pricing/delivery-quote';

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

    // --- DELIVERY ADDRESS VALIDATION ---
    // La dirección no puede confiarse al cliente: hay que verificar que exista
    // y que sea del comprador, o cualquiera podría mandar el id de la dirección
    // de otra persona.
    if (!order.delivery_address_id) {
      return NextResponse.json(
        { error: 'Debes seleccionar una dirección de entrega para el pedido.' },
        { status: 400 }
      );
    }

    const { data: deliveryAddress, error: addressError } = await supabase
      .from('delivery_addresses')
      .select('id, buyer_id, label, address_line, neighborhood, municipality, department, latitude, longitude')
      .eq('id', order.delivery_address_id)
      .maybeSingle();

    if (addressError) {
      return NextResponse.json({ error: addressError.message }, { status: 400 });
    }

    if (!deliveryAddress) {
      return NextResponse.json(
        { error: 'La dirección de entrega seleccionada no existe.' },
        { status: 400 }
      );
    }

    if (deliveryAddress.buyer_id !== user.id) {
      return NextResponse.json(
        { error: 'La dirección de entrega no pertenece a este usuario.' },
        { status: 403 }
      );
    }

    // Copia congelada: la orden debe conservar a dónde se envió, aunque después
    // el comprador edite o borre esa dirección.
    const deliveryAddressSnapshot = {
      label: deliveryAddress.label,
      address_line: deliveryAddress.address_line,
      neighborhood: deliveryAddress.neighborhood,
      municipality: deliveryAddress.municipality,
      department: deliveryAddress.department,
      latitude: deliveryAddress.latitude,
      longitude: deliveryAddress.longitude,
    };
    // --- END DELIVERY ADDRESS VALIDATION ---

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

    // El domicilio se cotiza contra la tienda que despacha, así que sin ella no
    // hay pedido posible.
    if (!storeOrders?.length || !storeOrders[0].store_id) {
      return NextResponse.json({ error: 'El pedido debe indicar la tienda que lo despacha' }, { status: 400 });
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

    // --- MINIMUM ORDER PRICE VALIDATION ---
    // Se compara contra el valor de los productos, no contra el total: el mínimo
    // significa "cuánto compró", y sumarle comisiones y domicilio dejaría pasar
    // pedidos mucho más pequeños de los que el cliente autorizó.
    const { data: minPriceRow } = await supabase
      .from('order_min_price_history')
      .select('min_price')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (minPriceRow && recalculatedSubtotal < minPriceRow.min_price) {
      return NextResponse.json({
        error: `El pedido no alcanza el valor mínimo de $${minPriceRow.min_price.toLocaleString('es-CO')} para poder procesarse.`,
      }, { status: 400 });
    }
    // --- END MINIMUM ORDER PRICE VALIDATION ---

    // --- PRICING: comisiones y domicilio, ambos derivados del servidor ---
    // El `delivery_fee` que mande el navegador se ignora por completo. Antes se
    // usaba tal cual (`order.delivery_fee !== undefined ? ...`), así que una
    // petición armada a mano podía guardar un domicilio de $0.
    const pricingSettings = await loadPricingSettings(supabase);

    // Cada orden es de una sola tienda (el carrito crea una por grupo), así que
    // hay exactamente una cotización de domicilio por orden.
    const deliveryFee = await quoteDeliveryFee(supabase, {
      storeId: String(storeOrders[0].store_id),
      deliveryAddressId: order.delivery_address_id,
      buyerId: user.id,
      subtotal: recalculatedSubtotal,
    });

    const pricing = computeOrderPricing(recalculatedSubtotal, deliveryFee, pricingSettings);
    // --- END SECURE RE-CALCULATION ---

    const orderInsertData: any = {
      buyer_id: order.buyer_id || null,
      client_id: (order as any).client_id || null,
      buyer_type: isWS ? 'wholesale' : 'retail',
      status: order.status,
      payment_status: order.payment_status,
      subtotal: pricing.productsSubtotal,
      service_commission_amount: pricing.serviceCommission,
      messages_amount: pricing.messagesAmount,
      platform_commission_amount: pricing.platformCommission,
      delivery_fee: pricing.deliveryFee,
      pricing_settings_id: pricingSettings.id,
      discount: 0,
      total: pricing.total,
      notes: order.notes,
      delivery_address_id: order.delivery_address_id,
      delivery_address_snapshot: deliveryAddressSnapshot,
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
    // Sin costo de domicilio confiable el pedido no se completa, y se corta
    // ANTES de insertar nada: crear la orden y dejarla sin envío calculado sería
    // peor que rechazarla.
    if (error instanceof DeliveryQuoteUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PricingConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
