import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '../../../lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { CreateOrderPayload } from '@/src/features/payment/types/payment.types';
import { computeOrderPricing } from '@/lib/pricing/compute-order-pricing';
import { loadPricingSettings, PricingConfigError } from '@/lib/pricing/settings';
import {
  quoteDeliveryFee,
  DeliveryQuoteUnavailableError,
} from '@/lib/pricing/delivery-quote';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { findReusableOrderId } from '@/lib/orders/find-reusable-order';
import { assertMinimumPurchase, buildOrderDraft, OrderDraftError } from '@/lib/orders/build-order-draft';

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

    /**
     * Canal de la venta. Una venta de mostrador no es un pedido del marketplace:
     * el comprador está parado frente al tendero, así que no hay dirección de
     * entrega, no hay domicilio que cotizar y no aplica el monto mínimo de
     * compra.
     *
     * Hasta ahora no existía la distinción, y la venta en sitio mandaba el mismo
     * cuerpo que el marketplace pero sin `delivery_address_id`: la petición moría
     * en el 400 de más abajo, nunca se creaba la orden y por eso el stock jamás
     * se descontaba. El síntoma reportado ("no descuenta el stock") era en
     * realidad "la venta no se registra".
     */
    const isInStore = (order as any).channel === 'in_store';

    let deliveryAddressSnapshot: Record<string, unknown> | null = null;

    if (!isInStore) {
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
        .select('id, buyer_id, label, address_line, neighborhood, municipality, department, delivery_instructions, latitude, longitude')
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
      deliveryAddressSnapshot = {
        label: deliveryAddress.label,
        address_line: deliveryAddress.address_line,
        neighborhood: deliveryAddress.neighborhood,
        municipality: deliveryAddress.municipality,
        department: deliveryAddress.department,
        delivery_instructions: deliveryAddress.delivery_instructions,
        latitude: deliveryAddress.latitude,
        longitude: deliveryAddress.longitude,
      };
      // --- END DELIVERY ADDRESS VALIDATION ---
    }

    // --- EL PEDIDO, DERIVADO EN EL SERVIDOR ---
    // Precios, ofertas y el reparto entre tiendas salen de la base. Del
    // navegador solo se toma qué productos y cuántos: `storeOrders` ya no decide
    // qué tiendas lleva el pedido, eso lo dicen los productos.
    const declaredStoreId = storeOrders?.[0]?.store_id ? String(storeOrders[0].store_id) : null;

    // Una venta de mostrador la registra la tienda, no un comprador cualquiera:
    // sin esto, cualquier usuario podría crear ventas ya "entregadas" y pagadas
    // en una tienda ajena, descontándole el inventario.
    if (isInStore) {
      if (!declaredStoreId) {
        return NextResponse.json({ error: 'La venta debe indicar la tienda que la registra' }, { status: 400 });
      }
      if (!(await canManageStore(supabase, declaredStoreId, user.id))) {
        return NextResponse.json(
          { error: 'No tienes permisos para registrar ventas en esta tienda.' },
          { status: 403 }
        );
      }
    }

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    const draft = await buildOrderDraft(supabase, service, items, {
      buyerProfileId: isInStore ? order.buyer_id || user.id : user.id,
      // En mostrador no aplica el bloqueo: ahí quien registra la venta es la tienda.
      blockedBuyerId: isInStore ? undefined : user.id,
      // No se validaba en ningún punto: se podían pedir 999 de un producto con 2,
      // y el trigger que descuenta tampoco impide dejar el stock en negativo.
      checkStock: true,
    });

    // En mostrador se vende lo de esa tienda y nada más. Antes no se
    // comprobaba: bastaba declarar una tienda propia para vender, y descontar,
    // productos de otra.
    if (isInStore && (draft.storeParts.length !== 1 || draft.storeParts[0].storeId !== declaredStoreId)) {
      return NextResponse.json(
        { error: 'Los productos de la venta no son de la tienda que la registra.' },
        { status: 400 }
      );
    }

    const isWS = draft.isWholesale;
    const recalculatedItems = draft.items;
    const recalculatedSubtotal = draft.productsSubtotal;
    const recalculatedListSubtotal = draft.productsListSubtotal;

    // Una parte por tienda. De lo que mandó el navegador solo se conservan las
    // notas y la marca de refrigerado de esa tienda.
    const recalculatedStoreOrders = draft.storeParts.map((parte) => {
      const declarado = (storeOrders ?? []).find((so) => String(so.store_id) === parte.storeId);
      return {
        store_id: parte.storeId,
        subtotal: parte.subtotal,
        has_refrigerated: declarado?.has_refrigerated ?? false,
        notes: declarado?.notes ?? '',
      };
    });

    // El mínimo se compara contra el valor de los productos de TODO el pedido,
    // no contra el total ni tienda por tienda: existe para que valga la pena
    // despachar un domicilio, y el domicilio es uno por pedido. En mostrador no
    // aplica: el comprador se lleva la compra en la mano.
    if (!isInStore) {
      await assertMinimumPurchase(supabase, draft);
    }

    // Un reintento con el mismo carrito reutiliza el pedido pendiente en vez de
    // crear otro. Va antes de cotizar el domicilio: ese pedido ya tiene el suyo.
    // ¿Quiere pagar con su saldo a favor, y tiene? Lo que mande el navegador es
    // solo la intención; cuánto se aparta lo decide el servidor más abajo.
    let wantsCredit = false;
    if (!isInStore && (order as any).use_credit === true) {
      const { data: saldo } = await service.rpc('buyer_credit_balance', { p_buyer: user.id });
      wantsCredit = Number(saldo ?? 0) > 0;
    }

    if (!isInStore) {
      const reusableId = await findReusableOrderId(supabase, {
        buyerId: user.id,
        storeIds: draft.storeParts.map((p) => p.storeId),
        deliveryAddressId: order.delivery_address_id!,
        items: recalculatedItems,
      });

      if (reusableId) {
        const { data: reused } = await supabase
          .from('orders')
          .select('*, order_items (*)')
          .eq('id', reusableId)
          .single();

        // El saldo apartado de un pedido es fijo: no se cambia en un reintento.
        // Si el comprador ahora eligió distinto (antes sin saldo y ahora con, o
        // al revés), ese pedido no sirve y se crea uno nuevo; el anterior vence
        // solo y devuelve lo que tuviera apartado.
        const usaSaldo = Number((reused as any)?.credit_applied ?? 0) > 0;
        if (reused && usaSaldo === wantsCredit) {
          return NextResponse.json({ data: reused, idempotent: true }, { status: 200 });
        }
      }
    }

    // --- PRICING: comisiones y domicilio, ambos derivados del servidor ---
    // El `delivery_fee` que mande el navegador se ignora por completo. Antes se
    // usaba tal cual (`order.delivery_fee !== undefined ? ...`), así que una
    // petición armada a mano podía guardar un domicilio de $0.
    /**
     * En mostrador el comprador paga el precio de la tienda y ya: no hay
     * domicilio que cotizar, ni comisión de servicio, ni mensajes, ni comisión de
     * plataforma. Esas se cobran por intermediar una venta a distancia, y acá no
     * hay intermediación.
     */
    const pricing = isInStore
      ? {
          productsSubtotal: recalculatedSubtotal,
          productsListSubtotal: recalculatedListSubtotal,
          discountTotal: Math.max(0, recalculatedListSubtotal - recalculatedSubtotal),
          serviceCommission: 0,
          messagesAmount: 0,
          platformCommission: 0,
          deliveryFee: 0,
          total: recalculatedSubtotal,
        }
      : null;

    let pricingSettingsId: string | null = null;

    let finalPricing = pricing;
    if (!finalPricing) {
      const pricingSettings = await loadPricingSettings(supabase);
      pricingSettingsId = pricingSettings.id;

      // Todas las tiendas del pedido comparten punto de recogida (lo garantiza
      // `buildOrderDraft`), así que hay una sola cotización de domicilio y se
      // puede pedir desde cualquiera de ellas.
      const deliveryFee = await quoteDeliveryFee(supabase, {
        storeId: draft.storeParts[0].storeId,
        deliveryAddressId: order.delivery_address_id!,
        buyerId: user.id,
        subtotal: recalculatedSubtotal,
      });

      finalPricing = computeOrderPricing(
        recalculatedSubtotal,
        deliveryFee,
        pricingSettings,
        recalculatedListSubtotal
      );
    }
    // --- END SECURE RE-CALCULATION ---

    const orderInsertData: any = {
      // Un pedido del marketplace es de quien tiene la sesión. Antes se tomaba
      // del cuerpo: se podía crear un pedido a nombre de otro, o sin comprador.
      // En mostrador sí lo dice la tienda (o va vacío, con `client_id`).
      buyer_id: isInStore ? order.buyer_id || null : user.id,
      client_id: (order as any).client_id || null,
      buyer_type: isWS ? 'wholesale' : 'retail',
      status: order.status,
      payment_status: order.payment_status,
      subtotal: finalPricing.productsSubtotal,
      service_commission_amount: finalPricing.serviceCommission,
      messages_amount: finalPricing.messagesAmount,
      platform_commission_amount: finalPricing.platformCommission,
      delivery_fee: finalPricing.deliveryFee,
      pricing_settings_id: pricingSettingsId,
      // Sigue en cero aunque ahora haya ofertas: `subtotal` ya guarda el valor
      // CON el descuento aplicado, así que apuntarlo también acá lo contaría
      // dos veces. Además `discount` es de la orden y el detalle lo muestra
      // contra el subtotal de su tienda, que no es el mismo número.
      discount: 0,
      // Con varias tiendas nadie puede pedir el mensajero por su cuenta: lo
      // junta un patinador en la bahía.
      fulfillment: draft.storeParts.length > 1 ? 'runner' : 'store',
      total: finalPricing.total,
      notes: order.notes,
      delivery_address_id: isInStore ? null : order.delivery_address_id,
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

    // El saldo se aparta al final, con el pedido ya completo: si el saldo cubre
    // todo, la base lo deja pagado y confirmado, y para eso la tienda y los
    // productos ya tienen que estar.
    if (wantsCredit) {
      const { error: creditError } = await service.rpc('reserve_order_credit', {
        p_order: newOrder.id,
        p_buyer: user.id,
      });

      if (creditError) {
        // Un pedido que el comprador creyó pagar con saldo y quedó por el total
        // es peor que ninguno: se deshace y reintenta.
        console.error('orders: no se pudo apartar el saldo a favor', creditError);
        await supabase.from('orders').delete().eq('id', newOrder.id);
        return NextResponse.json(
          { error: 'No pudimos usar tu saldo a favor en este momento. Intenta de nuevo.' },
          { status: 503 }
        );
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
    if (error instanceof OrderDraftError) {
      return NextResponse.json(
        { error: error.message, ...(error.code ? { code: error.code } : {}), ...error.extra },
        { status: error.status }
      );
    }
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
