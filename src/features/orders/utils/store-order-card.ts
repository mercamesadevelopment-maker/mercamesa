import type { Order, OrderStatus, OrderStatusHistoryItem } from '@/src/features/orders/types/order.types';
import type { OrderItem } from '@/lib/orders/types';
import { formatDeliveryAddress, getDeliveryInstructions } from './format-delivery-address';

/**
 * Arma la tarjeta de una parte de pedido (`store_orders`) para el panel de
 * pedidos de la tienda y del admin, a partir de lo que traen sus consultas.
 *
 * El `id` de la tarjeta es el de la parte, no el del pedido: un pedido de varias
 * tiendas tiene una tarjeta por tienda, y las acciones (cambiar estado, revertir,
 * cancelar la parte, notas de empaque) la buscan por `id`. Con el id del pedido,
 * dos tarjetas lo compartían y la acción sobre la parte B caía en la A.
 *
 * Estaba copiado en `app/seller/orders/hooks/use-orders.ts` y
 * `app/admin/orders/hooks/use-orders.ts`.
 */
export function toStoreOrderCard(so: any, itemsData: any[]): Order {
  const parentOrder = so.orders;
  const buyer = parentOrder?.profiles;
  const addressStr = formatDeliveryAddress(parentOrder?.delivery_address_snapshot, parentOrder?.delivery_addresses);
  const deliveryInstructions = getDeliveryInstructions(
    parentOrder?.delivery_address_snapshot,
    parentOrder?.delivery_addresses
  );

  // Solo los productos de esta tienda: el pedido puede traer los de otras.
  const storeItems: OrderItem[] = (itemsData || [])
    .filter((item: any) => item.order_id === so.order_id && item.store_products?.store_id === so.store_id)
    .map((item: any) => ({
      id: item.id,
      name: item.catalog_name || 'Producto',
      qty: Number(item.quantity),
      price: Number(item.unit_price),
      unit: item.unit_name || 'unid',
      emoji: getEmojiForName(item.catalog_name),
      // La indicación que el comprador escribió en la canasta ("más
      // verde", "bien maduro"). Es para quien arma el pedido.
      notes: item.notes || undefined,
    }));

  const client =
    buyer?.clients && Array.isArray(buyer.clients) && buyer.clients.length > 0 ? buyer.clients[0] : null;

  const historyData: OrderStatusHistoryItem[] = (so.store_order_status_history || [])
    .map((h: any) => ({
      id: h.id,
      status: h.status as OrderStatus,
      notes: h.notes,
      createdAt: h.created_at,
      changedByName: h.profiles?.full_name || null,
      isReversal: !!h.is_reversal,
    }))
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    id: so.id,
    storeOrderId: so.id,
    code: so.code,
    parentCode: parentOrder?.code,
    fulfillment: parentOrder?.fulfillment === 'consolidated' ? 'consolidated' : 'store',
    consolidation: {
      runnerRequired: Boolean(parentOrder?.runner_required),
      logisticsRequired: Boolean(parentOrder?.logistics_required),
    },
    packingNotes: so.packing_notes ?? null,
    collectedAt: so.collected_at ?? null,
    bayReceivedAt: so.bay_received_at ?? null,
    date: so.created_at || new Date().toISOString(),
    storeId: so.store_id,
    storeName: so.stores?.name || 'Mi Tienda',
    storeEmoji: '🏪',
    items: storeItems,
    total: Number(so.subtotal),
    status: so.status as OrderStatus,
    buyerId: buyer?.full_name || parentOrder?.buyer_id || 'Cliente',
    address: addressStr,
    deliveryInstructions,
    paymentMethod: parentOrder?.payment_status === 'approved' ? 'Tarjeta (Aprobado)' : 'Pendiente de Pago',
    buyerName: client?.full_name || buyer?.full_name || 'Cliente',
    buyerPhone: client?.phone || buyer?.phone || null,
    buyerEmail: client?.email || buyer?.email || null,
    buyerDocument: client?.document_number || buyer?.document_number || null,
    notes: so.notes || parentOrder?.notes || null,
    paymentStatus: parentOrder?.payment_status || 'pending',
    discount: parentOrder?.discount ? Number(parentOrder.discount) : 0,
    deliveryFee: parentOrder?.delivery_fee ? Number(parentOrder.delivery_fee) : 0,
    serviceCommission: Number(parentOrder?.service_commission_amount ?? 0),
    messagesAmount: Number(parentOrder?.messages_amount ?? 0),
    platformCommission: Number(parentOrder?.platform_commission_amount ?? 0),
    subtotal: Number(so.subtotal),
    history: historyData,
  };
}

export function getEmojiForName(name?: string): string {
  if (!name) return '📦';
  const n = name.toLowerCase();
  if (n.includes('tomate')) return '🍅';
  if (n.includes('limón') || n.includes('limon')) return '🍋';
  if (n.includes('zanahoria')) return '🥕';
  if (n.includes('papa')) return '🥔';
  if (n.includes('maíz') || n.includes('maiz')) return '🌽';
  if (n.includes('ají') || n.includes('aji')) return '🌶️';
  if (n.includes('ajo')) return '🧄';
  if (n.includes('cebolla')) return '🧅';
  if (n.includes('carne') || n.includes('res') || n.includes('punta')) return '🥩';
  if (n.includes('banano') || n.includes('plátano')) return '🍌';
  if (n.includes('manzana')) return '🍎';
  if (n.includes('cilantro')) return '🥬';
  return '📦';
}
