import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeOrderPricing } from '@/lib/pricing/compute-order-pricing';
import { loadPricingSettings, PricingConfigError } from '@/lib/pricing/settings';
import {
  quoteDeliveryFee,
  DeliveryQuoteUnavailableError,
} from '@/lib/pricing/delivery-quote';

/**
 * Desglose del precio de un pedido ANTES de crearlo, para que el carrito muestre
 * exactamente lo que se va a cobrar.
 *
 * Los precios y el domicilio se derivan del servidor: lo que mande el navegador
 * son solo qué productos y cuántos. `POST /api/orders` vuelve a hacer este mismo
 * cálculo por su cuenta, así que esta ruta no es una fuente de verdad, es una
 * vista previa.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const storeId: string | undefined = body.store_id;
    const deliveryAddressId: string | undefined = body.delivery_address_id;
    const items: { store_product_id: string; quantity: number }[] = body.items ?? [];

    if (!storeId) {
      return NextResponse.json({ error: 'store_id es requerido' }, { status: 400 });
    }
    if (!deliveryAddressId) {
      return NextResponse.json(
        { error: 'Debes seleccionar una dirección de entrega para cotizar el envío.' },
        { status: 400 }
      );
    }
    if (items.length === 0) {
      return NextResponse.json({ error: 'El pedido debe contener al menos un producto' }, { status: 400 });
    }

    // Tipo de comprador desde la base, nunca desde el navegador: define si aplica
    // el precio mayorista.
    const { data: profile } = await supabase
      .from('profiles')
      .select('buyer_type')
      .eq('id', user.id)
      .single();
    const isWS = profile?.buyer_type === 'wholesale';

    const { data: dbProducts, error: productsError } = await supabase
      .from('store_products')
      .select('id, price_per_unit, wholesale_price, store_id')
      .in(
        'id',
        items.map((i) => i.store_product_id)
      );

    if (productsError || !dbProducts) {
      return NextResponse.json(
        { error: productsError?.message || 'Error al verificar los productos' },
        { status: 400 }
      );
    }

    let productsSubtotal = 0;
    for (const item of items) {
      const dbProd = dbProducts.find((p) => p.id === item.store_product_id);
      if (!dbProd) {
        return NextResponse.json({ error: 'Uno o más productos del pedido no son válidos' }, { status: 400 });
      }
      const unitPrice = isWS
        ? Number(dbProd.wholesale_price || dbProd.price_per_unit || 0)
        : Number(dbProd.price_per_unit || 0);
      productsSubtotal += unitPrice * Number(item.quantity);
    }

    const settings = await loadPricingSettings(supabase);

    const deliveryFee = await quoteDeliveryFee(supabase, {
      storeId,
      deliveryAddressId,
      buyerId: user.id,
      subtotal: productsSubtotal,
    });

    const pricing = computeOrderPricing(productsSubtotal, deliveryFee, settings);

    return NextResponse.json({ data: pricing }, { status: 200 });
  } catch (error: unknown) {
    // Sin domicilio no hay compra: 503 (falla temporal del proveedor), con el
    // mensaje que el comprador debe leer tal cual.
    if (error instanceof DeliveryQuoteUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof PricingConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Error cotizando el pedido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
