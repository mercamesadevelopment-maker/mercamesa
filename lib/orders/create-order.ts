import type { SupabaseClient } from '@supabase/supabase-js';
import { fulfillmentSnapshot } from '@/lib/orders/consolidated-order';
import type { CreateOrderPayload } from '@/lib/orders/types';
import { computeOrderPricing } from '@/lib/pricing/compute-order-pricing';
import { loadPricingSettings } from '@/lib/pricing/settings';
import { quoteDeliveryFee } from '@/lib/pricing/delivery-quote';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { findReusableOrderId } from '@/lib/orders/find-reusable-order';
import { assertMinimumPurchase, buildOrderDraft, OrderDraftError } from '@/lib/orders/build-order-draft';

/** Lo que responde la ruta. Los errores de negocio se lanzan como `OrderDraftError`. */
export interface CreateOrderResult {
  status: number;
  body: Record<string, unknown>;
}

type StorePart = { storeId: string; subtotal: number };

/**
 * Crea un pedido del marketplace o registra una venta de mostrador.
 *
 * Del navegador solo se toma qué productos y cuántos, la dirección, las notas y
 * la intención de usar saldo: precios, ofertas, domicilio, comisiones, estado y
 * comprador los decide el servidor.
 *
 * Lanza `OrderDraftError` (con su estado HTTP), `DeliveryQuoteUnavailableError`
 * o `PricingConfigError`; la ruta los traduce.
 */
export async function createOrder(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  userId: string,
  body: CreateOrderPayload
): Promise<CreateOrderResult> {
  const { order, items, storeOrders } = body;

  if (!order.client_idempotency_key) {
    return { status: 400, body: { error: 'client_idempotency_key is required' } };
  }

  const { data: existingOrder, error: idempotencyError } = await supabase
    .from('orders')
    .select('*, order_items (*)')
    .eq('client_idempotency_key', order.client_idempotency_key)
    .single();

  if (idempotencyError && idempotencyError.code !== 'PGRST116') {
    return { status: 400, body: { error: idempotencyError.message } };
  }
  if (existingOrder) return { status: 200, body: { data: existingOrder, idempotent: true } };

  /**
   * Canal de la venta. Una venta de mostrador no es un pedido del marketplace:
   * el comprador está parado frente al tendero, así que no hay dirección de
   * entrega, no hay domicilio que cotizar y no aplica el monto mínimo de
   * compra.
   *
   * Hasta ahora no existía la distinción, y la venta en sitio mandaba el mismo
   * cuerpo que el marketplace pero sin `delivery_address_id`: la petición moría
   * en el 400 de la dirección, nunca se creaba la orden y por eso el stock jamás
   * se descontaba. El síntoma reportado ("no descuenta el stock") era en
   * realidad "la venta no se registra".
   */
  const isInStore = (order as any).channel === 'in_store';

  const deliveryAddressSnapshot = isInStore
    ? null
    : await loadDeliveryAddressSnapshot(supabase, order.delivery_address_id, userId);

  // --- EL PEDIDO, DERIVADO EN EL SERVIDOR ---
  // Precios, ofertas y el reparto entre tiendas salen de la base. Del navegador
  // solo se toma qué productos y cuántos: `storeOrders` ya no decide qué tiendas
  // lleva el pedido, eso lo dicen los productos.
  const declaredStoreId = storeOrders?.[0]?.store_id ? String(storeOrders[0].store_id) : null;

  // Una venta de mostrador la registra la tienda, no un comprador cualquiera:
  // sin esto, cualquier usuario podría crear ventas ya "entregadas" y pagadas en
  // una tienda ajena, descontándole el inventario.
  if (isInStore) {
    if (!declaredStoreId) {
      return { status: 400, body: { error: 'La venta debe indicar la tienda que la registra' } };
    }
    if (!(await canManageStore(supabase, declaredStoreId, userId))) {
      return { status: 403, body: { error: 'No tienes permisos para registrar ventas en esta tienda.' } };
    }
  }

  const draft = await buildOrderDraft(supabase, service, items, {
    buyerProfileId: isInStore ? order.buyer_id || userId : userId,
    // En mostrador no aplica el bloqueo: ahí quien registra la venta es la tienda.
    blockedBuyerId: isInStore ? undefined : userId,
    // No se validaba en ningún punto: se podían pedir 999 de un producto con 2,
    // y el trigger que descuenta tampoco impide dejar el stock en negativo.
    checkStock: true,
  });

  // En mostrador se vende lo de esa tienda y nada más. Antes no se comprobaba:
  // bastaba declarar una tienda propia para vender, y descontar, productos de
  // otra.
  if (isInStore && (draft.storeParts.length !== 1 || draft.storeParts[0].storeId !== declaredStoreId)) {
    return { status: 400, body: { error: 'Los productos de la venta no son de la tienda que la registra.' } };
  }

  const recalculatedStoreOrders = toStoreOrderRows(draft.storeParts, storeOrders ?? []);

  // El mínimo se compara contra el valor de los productos de TODO el pedido, no
  // contra el total ni tienda por tienda: existe para que valga la pena
  // despachar un domicilio, y el domicilio es uno por pedido. En mostrador no
  // aplica: el comprador se lleva la compra en la mano.
  if (!isInStore) await assertMinimumPurchase(supabase, draft);

  // ¿Quiere pagar con su saldo a favor, y tiene? Lo que mande el navegador es
  // solo la intención; cuánto se aparta lo decide la base al final.
  let wantsCredit = false;
  if (!isInStore && (order as any).use_credit === true) {
    const { data: saldo } = await service.rpc('buyer_credit_balance', { p_buyer: userId });
    wantsCredit = Number(saldo ?? 0) > 0;
  }

  // Un reintento con el mismo carrito reutiliza el pedido pendiente en vez de
  // crear otro. Va antes de cotizar el domicilio: ese pedido ya tiene el suyo.
  if (!isInStore) {
    const reused = await findReusable(supabase, userId, draft, order.delivery_address_id!, wantsCredit);
    if (reused) return { status: 200, body: { data: reused, idempotent: true } };
  }

  // --- PRICING: comisiones y domicilio, ambos derivados del servidor ---
  // El `delivery_fee` que mande el navegador se ignora por completo. Antes se
  // usaba tal cual, así que una petición armada a mano podía guardar un
  // domicilio de $0.
  let pricingSettingsId: string | null = null;
  let pricing = isInStore ? inStorePricing(draft.productsSubtotal, draft.productsListSubtotal) : null;
  if (!pricing) {
    const pricingSettings = await loadPricingSettings(supabase);
    pricingSettingsId = pricingSettings.id;

    // Todas las tiendas del pedido comparten punto de recogida (lo garantiza
    // `buildOrderDraft`), así que hay una sola cotización de domicilio y se
    // puede pedir desde cualquiera de ellas.
    const deliveryFee = await quoteDeliveryFee(supabase, {
      storeId: draft.storeParts[0].storeId,
      deliveryAddressId: order.delivery_address_id!,
      buyerId: userId,
      subtotal: draft.productsSubtotal,
    });

    pricing = computeOrderPricing(draft.productsSubtotal, deliveryFee, pricingSettings, draft.productsListSubtotal);
  }

  const orderInsertData: any = {
    // Un pedido del marketplace es de quien tiene la sesión. Antes se tomaba
    // del cuerpo: se podía crear un pedido a nombre de otro, o sin comprador.
    // En mostrador sí lo dice la tienda (o va vacío, con `client_id`).
    buyer_id: isInStore ? order.buyer_id || null : userId,
    client_id: (order as any).client_id || null,
    buyer_type: draft.isWholesale ? 'wholesale' : 'retail',
    // Un pedido del marketplace nace pendiente y sin pagar: lo pagado lo decide
    // ZonaPagos (o el saldo a favor, más abajo). Antes se tomaba del cuerpo, y
    // un comprador podía crear su pedido ya «aprobado». La venta de mostrador
    // sí trae su estado: la registra la tienda, ya comprobada arriba.
    status: isInStore ? order.status : 'pending',
    payment_status: isInStore ? order.payment_status : 'pending',
    subtotal: pricing.productsSubtotal,
    service_commission_amount: pricing.serviceCommission,
    messages_amount: pricing.messagesAmount,
    platform_commission_amount: pricing.platformCommission,
    delivery_fee: pricing.deliveryFee,
    pricing_settings_id: pricingSettingsId,
    // Sigue en cero aunque ahora haya ofertas: `subtotal` ya guarda el valor
    // CON el descuento aplicado, así que apuntarlo también acá lo contaría dos
    // veces. Además `discount` es de la orden y el detalle lo muestra contra el
    // subtotal de su tienda, que no es el mismo número.
    discount: 0,
    // Con varias tiendas nadie pide el mensajero por su cuenta: se junta en la
    // bahía y sale uno solo. Cómo, lo dice la plaza.
    ...(await fulfillmentSnapshot(supabase, draft.storeParts[0].storeId, draft.storeParts.length)),
    total: pricing.total,
    notes: order.notes,
    delivery_address_id: isInStore ? null : order.delivery_address_id,
    delivery_address_snapshot: deliveryAddressSnapshot,
    client_idempotency_key: order.client_idempotency_key,
  };

  return persistOrder(supabase, service, {
    order: orderInsertData,
    items: draft.items,
    storeOrders: recalculatedStoreOrders,
    creditBuyerId: wantsCredit ? userId : null,
  });
}

/**
 * La dirección de entrega, verificada y congelada.
 *
 * No puede confiarse al cliente: hay que verificar que exista y que sea del
 * comprador, o cualquiera podría mandar el id de la dirección de otra persona.
 * La copia queda en la orden aunque después el comprador edite o borre la
 * dirección.
 */
async function loadDeliveryAddressSnapshot(
  supabase: SupabaseClient<any>,
  addressId: string | null | undefined,
  userId: string
): Promise<Record<string, unknown>> {
  if (!addressId) throw new OrderDraftError('Debes seleccionar una dirección de entrega para el pedido.');

  const { data: address, error } = await supabase
    .from('delivery_addresses')
    .select('id, buyer_id, label, address_line, neighborhood, municipality, department, delivery_instructions, latitude, longitude')
    .eq('id', addressId)
    .maybeSingle();

  if (error) throw new OrderDraftError(error.message);
  if (!address) throw new OrderDraftError('La dirección de entrega seleccionada no existe.');
  if (address.buyer_id !== userId) throw new OrderDraftError('La dirección de entrega no pertenece a este usuario.', 403);

  return {
    label: address.label,
    address_line: address.address_line,
    neighborhood: address.neighborhood,
    municipality: address.municipality,
    department: address.department,
    delivery_instructions: address.delivery_instructions,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

/**
 * Una parte por tienda. De lo que mandó el navegador solo se conservan las notas
 * y la marca de refrigerado de esa tienda.
 */
export function toStoreOrderRows(
  storeParts: StorePart[],
  declared: { store_id?: unknown; has_refrigerated?: boolean; notes?: string }[]
) {
  return storeParts.map((parte) => {
    const declarado = declared.find((so) => String(so.store_id) === parte.storeId);
    return {
      store_id: parte.storeId,
      subtotal: parte.subtotal,
      has_refrigerated: declarado?.has_refrigerated ?? false,
      notes: declarado?.notes ?? '',
    };
  });
}

/**
 * En mostrador el comprador paga el precio de la tienda y ya: no hay domicilio
 * que cotizar, ni comisión de servicio, ni mensajes, ni comisión de plataforma.
 * Esas se cobran por intermediar una venta a distancia, y acá no hay
 * intermediación.
 */
export function inStorePricing(productsSubtotal: number, productsListSubtotal: number) {
  return {
    productsSubtotal,
    productsListSubtotal,
    discountTotal: Math.max(0, productsListSubtotal - productsSubtotal),
    serviceCommission: 0,
    messagesAmount: 0,
    platformCommission: 0,
    deliveryFee: 0,
    total: productsSubtotal,
  };
}

/**
 * El pedido pendiente del mismo carrito, si sirve para este reintento.
 *
 * El saldo apartado de un pedido es fijo: no se cambia en un reintento. Si el
 * comprador ahora eligió distinto (antes sin saldo y ahora con, o al revés), ese
 * pedido no sirve y se crea uno nuevo; el anterior vence solo y devuelve lo que
 * tuviera apartado.
 */
async function findReusable(
  supabase: SupabaseClient<any>,
  userId: string,
  draft: { storeParts: StorePart[]; items: any[] },
  deliveryAddressId: string,
  wantsCredit: boolean
) {
  const reusableId = await findReusableOrderId(supabase, {
    buyerId: userId,
    storeIds: draft.storeParts.map((p) => p.storeId),
    deliveryAddressId,
    items: draft.items,
  });
  if (!reusableId) return null;

  const { data: reused } = await supabase.from('orders').select('*, order_items (*)').eq('id', reusableId).single();
  const usaSaldo = Number((reused as any)?.credit_applied ?? 0) > 0;
  return reused && usaSaldo === wantsCredit ? reused : null;
}

/**
 * Escribe el pedido, sus productos y sus partes, y aparta el saldo si se pidió.
 * Si algo falla, se borra el pedido: no queda uno a medias.
 *
 * Las escrituras van con el cliente de servicio: quien llama ya pasó por las
 * comprobaciones, y la base no le da permiso de escribir pedidos a una sesión
 * (cualquiera podría cambiar uno ajeno desde el navegador).
 */
async function persistOrder(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  input: { order: Record<string, unknown>; items: any[]; storeOrders: Record<string, unknown>[]; creditBuyerId: string | null }
): Promise<CreateOrderResult> {
  const { data: newOrder, error: orderError } = await service.from('orders').insert(input.order).select().single();
  if (orderError) return { status: 400, body: { error: orderError.message } };

  const deshacer = () => service.from('orders').delete().eq('id', newOrder.id);

  if (input.items.length > 0) {
    const { error } = await service.from('order_items').insert(input.items.map((item) => ({ ...item, order_id: newOrder.id })));
    if (error) {
      await deshacer();
      return { status: 400, body: { error: error.message } };
    }
  }

  if (input.storeOrders.length > 0) {
    const { error } = await service.from('store_orders').insert(input.storeOrders.map((so) => ({ ...so, order_id: newOrder.id })));
    if (error) {
      await deshacer();
      return { status: 400, body: { error: error.message } };
    }
  }

  // El saldo se aparta al final, con el pedido ya completo: si el saldo cubre
  // todo, la base lo deja pagado y confirmado, y para eso la tienda y los
  // productos ya tienen que estar.
  if (input.creditBuyerId) {
    const { error } = await service.rpc('reserve_order_credit', { p_order: newOrder.id, p_buyer: input.creditBuyerId });
    if (error) {
      // Un pedido que el comprador creyó pagar con saldo y quedó por el total
      // es peor que ninguno: se deshace y reintenta.
      console.error('orders: no se pudo apartar el saldo a favor', error);
      await deshacer();
      return { status: 503, body: { error: 'No pudimos usar tu saldo a favor en este momento. Intenta de nuevo.' } };
    }
  }

  const { data: fullOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*, order_items (*)')
    .eq('id', newOrder.id)
    .single();

  return { status: 201, body: { data: fetchError ? newOrder : fullOrder, idempotent: false } };
}
