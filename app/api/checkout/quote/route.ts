import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { computeOrderPricing } from '@/lib/pricing/compute-order-pricing';
import { loadPricingSettings, PricingConfigError } from '@/lib/pricing/settings';
import {
  quoteDeliveryFee,
  DeliveryQuoteUnavailableError,
} from '@/lib/pricing/delivery-quote';
import { buildOrderDraft, OrderDraftError } from '@/lib/orders/build-order-draft';

/**
 * Desglose del precio de un pedido ANTES de crearlo, para que el carrito muestre
 * exactamente lo que se va a cobrar.
 *
 * Los precios y el domicilio se derivan del servidor: lo que mande el navegador
 * son solo qué productos y cuántos. `POST /api/orders` vuelve a hacer este mismo
 * cálculo por su cuenta (`buildOrderDraft`), así que esta ruta no es una fuente
 * de verdad, es una vista previa.
 *
 * Se cotiza la canasta entera: un pedido puede llevar productos de varias
 * tiendas de la misma plaza y paga un solo domicilio.
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
    const deliveryAddressId: string | undefined = body.delivery_address_id;
    const items: { store_product_id: string; quantity: number }[] = body.items ?? [];

    if (!deliveryAddressId) {
      return NextResponse.json(
        { error: 'Debes seleccionar una dirección de entrega para cotizar el envío.' },
        { status: 400 }
      );
    }

    // Se avisa acá, al cotizar, de lo que impediría el pedido (tiendas que no
    // despachan juntas, comprador bloqueado), para que el comprador lo sepa en
    // el carrito y no después de llenar el pago.
    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const draft = await buildOrderDraft(supabase, service, items, {
      buyerProfileId: user.id,
      blockedBuyerId: user.id,
    });

    const settings = await loadPricingSettings(supabase);

    // Todas las tiendas del pedido comparten punto de recogida, así que el
    // domicilio se cotiza una vez, desde cualquiera de ellas.
    const deliveryFee = await quoteDeliveryFee(supabase, {
      storeId: draft.storeParts[0].storeId,
      deliveryAddressId,
      buyerId: user.id,
      subtotal: draft.productsSubtotal,
    });

    const pricing = computeOrderPricing(
      draft.productsSubtotal,
      deliveryFee,
      settings,
      draft.productsListSubtotal
    );

    return NextResponse.json({ data: pricing }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof OrderDraftError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}), ...error.extra },
        { status: error.status }
      );
    }
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
