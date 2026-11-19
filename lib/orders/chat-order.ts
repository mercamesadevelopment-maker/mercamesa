import type { SupabaseClient } from '@supabase/supabase-js';
import { assertMinimumPurchase, buildOrderDraft, type OrderDraft } from './build-order-draft';
import { createOrder } from './create-order';
import { quoteDeliveryFee } from '@/lib/pricing/delivery-quote';
import { computeOrderPricing, type OrderPricing } from '@/lib/pricing/compute-order-pricing';
import { loadPricingSettings } from '@/lib/pricing/settings';
import { buyerInvoiceConcepts } from '@/lib/pricing/buyer-concepts';

/**
 * Un pedido armado por el chat de Meteor (`crear_orden`), con las mismas reglas
 * del carrito: precios, ofertas, existencias, mínimo de compra, tiendas que
 * pueden ir juntas y domicilio los decide el servidor (`buildOrderDraft`,
 * `createOrder`). Del chat solo llegan qué productos, cuántos y a qué dirección.
 *
 * Carolina nunca cobra: el pedido nace pendiente de pago y el comprador lo paga
 * en la app, desde «Mis órdenes». Si su saldo a favor alcanza, la base lo deja
 * pagado.
 */

export interface ChatOrderInput {
  buyerId: string;
  items: { storeProductId: string; quantity: number }[];
  addressId: string;
  notes?: string | null;
  useCredit?: boolean;
}

export interface ChatOrderPreview {
  draft: OrderDraft;
  pricing: OrderPricing;
  /** Los dos conceptos de la factura, como los ve el comprador. */
  concepts: { thirdPartyProducts: number; delivery: number };
  /** El saldo a favor que tiene; cuánto se usa lo decide la base al crear. */
  credit: number;
}

/** Arma el pedido sin escribir nada: lo que Carolina le muestra al comprador para que confirme. */
export async function previewChatOrder(service: SupabaseClient<any>, input: ChatOrderInput): Promise<ChatOrderPreview> {
  const draft = await buildOrderDraft(
    service,
    service,
    input.items.map((i) => ({ store_product_id: i.storeProductId, quantity: i.quantity })),
    { buyerProfileId: input.buyerId, blockedBuyerId: input.buyerId, checkStock: true, requirePublished: true }
  );
  await assertMinimumPurchase(service, draft);

  const [settings, deliveryFee, saldo] = await Promise.all([
    loadPricingSettings(service),
    // Todas las tiendas comparten punto de recogida (lo garantiza el borrador):
    // un solo domicilio, cotizado desde cualquiera.
    quoteDeliveryFee(service, {
      storeId: draft.storeParts[0].storeId,
      deliveryAddressId: input.addressId,
      buyerId: input.buyerId,
      subtotal: draft.productsSubtotal,
    }),
    service.rpc('buyer_credit_balance', { p_buyer: input.buyerId }),
  ]);
  const pricing = computeOrderPricing(draft.productsSubtotal, deliveryFee, settings, draft.productsListSubtotal);
  return {
    draft,
    pricing,
    concepts: buyerInvoiceConcepts(pricing.productsSubtotal, pricing.total),
    credit: Number(saldo.data ?? 0),
  };
}

/**
 * La llave de idempotencia del pedido. `createOrder` busca un pedido existente
 * por la llave sin filtrar por comprador (en la app lo filtra la sesión); con
 * el cliente de servicio, la llave lleva el comprador para que la de una
 * persona nunca encuentre el pedido de otra.
 */
export function chatOrderKey(buyerId: string, key: string): string {
  return `mcp:${buyerId}:${key}`;
}

export type PlacedChatOrder =
  | { ok: true; order: { id: string; code: string; total: number; payment_status: string; credit_applied: number }; repeated: boolean }
  | { ok: false; status: number; message: string };

/** Crea el pedido. Un reintento con la misma llave devuelve el mismo. */
export async function placeChatOrder(
  service: SupabaseClient<any>,
  input: ChatOrderInput & { key: string }
): Promise<PlacedChatOrder> {
  const r = await createOrder(service, service, input.buyerId, {
    order: {
      buyer_id: input.buyerId,
      buyer_type: 'retail',
      status: 'pending',
      payment_status: 'pending',
      notes: input.notes ?? undefined,
      delivery_address_id: input.addressId,
      client_idempotency_key: chatOrderKey(input.buyerId, input.key),
      use_credit: input.useCredit === true,
    },
    items: input.items.map((i) => ({
      store_product_id: i.storeProductId,
      quantity: i.quantity,
      // El servidor recalcula precios y nombres: estos campos no se usan.
      unit_price: 0,
      total_price: 0,
      catalog_name: '',
      unit_name: '',
    })),
    storeOrders: [],
  });

  const body = r.body as any;
  if (r.status >= 400) return { ok: false, status: r.status, message: String(body?.error ?? 'No se pudo crear el pedido.') };
  const order = body?.data;
  if (!order?.id) return { ok: false, status: 500, message: 'No se pudo crear el pedido.' };

  // `buyer_id` lo vuelve a comprobar: un pedido reutilizado siempre es del mismo comprador.
  if (order.buyer_id !== input.buyerId) return { ok: false, status: 409, message: 'No se pudo crear el pedido.' };

  return {
    ok: true,
    order: {
      id: order.id,
      code: order.code,
      total: Number(order.total),
      payment_status: order.payment_status,
      credit_applied: Number(order.credit_applied ?? 0),
    },
    repeated: Boolean(body?.idempotent),
  };
}
