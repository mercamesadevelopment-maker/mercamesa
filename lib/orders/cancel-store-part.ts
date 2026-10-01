import type { SupabaseClient } from '@supabase/supabase-js';
import { computeCancellationRefund, type RefundLine } from '@/lib/pqrs/refund-amount';
import { createNotification } from '@/lib/notifications/create-notification';
import { notifyRunnersOfOrder } from '@/lib/runner/notify';
import { MIN_CANCEL_REASON } from './cancel-part-rules';

/**
 * Una tienda no puede cumplir su parte de un pedido de varias tiendas.
 *
 * La parte se cancela, el resto del pedido sigue y al comprador se le abona
 * como saldo a favor lo que pagó por esos productos, con sus comisiones. Si era
 * la última parte que quedaba, se devuelve el pedido entero, con domicilio.
 *
 * La tienda no recibe un descuento por esto: esa parte nunca se le va a pagar
 * (una parte cancelada no entra a dispersión), así que no hay de dónde restar.
 *
 * Solo aplica a pedidos con patinador. En un pedido de una sola tienda cancelar
 * es anular la venta completa, y eso hoy lo decide un administrador.
 */

export class CancelPartError extends Error {
  readonly status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = 'CancelPartError';
    this.status = status;
  }
}

/** Estados desde los que la tienda todavía puede decir que no cumple. */
const CANCELABLE = ['confirmed', 'paid', 'packing', 'at_collection'];
/** Estados en los que una parte ya no cuenta para el pedido. */
const FUERA = ['cancelled', 'returned'];

export interface CancelPartResult {
  /** Lo abonado al comprador como saldo a favor. */
  refunded: number;
  /** No quedó ninguna parte en pie: el pedido entero se canceló. */
  orderCancelled: boolean;
}

export async function cancelStorePart(
  service: SupabaseClient<any>,
  params: { storeOrderId: string; actorId: string; reason: string }
): Promise<CancelPartResult> {
  const reason = params.reason.trim();
  if (reason.length < MIN_CANCEL_REASON) {
    throw new CancelPartError(
      `Cuéntale al comprador por qué no puedes cumplir (mínimo ${MIN_CANCEL_REASON} caracteres).`,
      400
    );
  }

  const { data: parte } = await service
    .from('store_orders')
    .select(
      `id, code, status, store_id, order_id, stores ( name ),
       orders (
         id, code, buyer_id, payment_status, fulfillment, bay_ready_at, status,
         subtotal, total, delivery_fee, service_commission_amount, messages_amount, platform_commission_amount,
         store_orders ( id, status ),
         order_items ( id, quantity, unit_price, store_products ( store_id ) )
       )`
    )
    .eq('id', params.storeOrderId)
    .maybeSingle();

  if (!parte) throw new CancelPartError('No encontramos ese pedido.', 404);

  const order = (parte as any).orders;
  const storeName = (parte as any).stores?.name ?? 'La tienda';

  if (order.fulfillment !== 'runner') {
    throw new CancelPartError(
      'Este pedido es solo de tu tienda. Para anularlo escríbele a MercaMesa desde «PQRS».'
    );
  }
  if (order.payment_status !== 'approved' || !order.buyer_id) {
    throw new CancelPartError('Este pedido no está pagado: no hay nada que devolver.');
  }

  const yaCancelada = parte.status === 'cancelled';
  if (!yaCancelada) {
    if (order.bay_ready_at) {
      throw new CancelPartError('El pedido ya está en la bahía: tu parte ya salió de la tienda.');
    }
    if (!CANCELABLE.includes(parte.status)) {
      throw new CancelPartError('En el estado en que está, esta parte ya no se puede cancelar.');
    }

    // El `in` repite la condición en la base: dos cancelaciones a la vez solo
    // cambian el estado una.
    const { error: cancelError } = await service
      .from('store_orders')
      .update({ status: 'cancelled' })
      .eq('id', parte.id)
      .in('status', CANCELABLE);
    if (cancelError) throw new Error(`No se pudo cancelar la parte: ${cancelError.message}`);

    await service.from('store_order_status_history').insert({
      store_order_id: parte.id,
      status: 'cancelled',
      notes: `La tienda no pudo cumplir su parte: ${reason}`,
      changed_by: params.actorId,
    });
  }

  // Si la parte ya estaba cancelada se sigue igual: puede ser el reintento de
  // una cancelación cuya devolución falló. La base no abona dos veces.
  const lines: RefundLine[] = (order.order_items ?? [])
    .filter((i: any) => i.store_products?.store_id === parte.store_id)
    .map((i: any) => ({ orderItemId: i.id, quantity: Number(i.quantity), unitPrice: Number(i.unit_price) }));

  const otrasEnPie = (order.store_orders ?? []).filter(
    (so: any) => so.id !== parte.id && !FUERA.includes(so.status)
  );
  const lastActivePart = otrasEnPie.length === 0;

  const { data: previas } = await service
    .from('order_refunds')
    .select('total_amount, store_order_id, origin')
    .eq('order_id', order.id);

  const propia = (previas ?? []).find((r: any) => r.store_order_id === parte.id && r.origin === 'store_cancel');
  const alreadyRefunded = (previas ?? [])
    .filter((r: any) => r !== propia)
    .reduce((sum: number, r: any) => sum + Number(r.total_amount), 0);

  const cuenta = computeCancellationRefund(
    {
      subtotal: Number(order.subtotal ?? 0),
      serviceCommission: Number(order.service_commission_amount ?? 0),
      messagesAmount: Number(order.messages_amount ?? 0),
      platformCommission: Number(order.platform_commission_amount ?? 0),
      deliveryFee: Number(order.delivery_fee ?? 0),
      total: Number(order.total ?? 0),
    },
    lines,
    { lastActivePart, alreadyRefunded }
  );

  if (!propia && cuenta.total > 0) {
    const { error: refundError } = await service.rpc('create_order_refund', {
      p: {
        pqrs_id: '',
        order_id: order.id,
        store_order_id: parte.id,
        store_id: parte.store_id,
        buyer_id: order.buyer_id,
        scope: cuenta.scope,
        products_amount: cuenta.products,
        service_commission_amount: cuenta.serviceCommission,
        platform_commission_amount: cuenta.platformCommission,
        messages_amount: cuenta.messages,
        delivery_amount: cuenta.delivery,
        total_amount: cuenta.total,
        // No la tienda: a ella esta parte no se le paga, así que no hay descuento.
        liable: 'platform',
        created_by: params.actorId,
        items: cuenta.items.map((i) => ({ order_item_id: i.orderItemId, quantity: i.quantity, amount: i.amount })),
      },
    });

    if (refundError) {
      // La parte ya quedó cancelada; lo que falta es la plata. Se dice tal cual
      // para que se reintente: la ruta acepta volver a llamarse.
      console.error('cancel-store-part: no se pudo abonar la devolución', refundError);
      throw new CancelPartError(
        'La parte quedó cancelada, pero no pudimos abonarle el saldo al comprador. Intenta de nuevo en un momento.',
        503
      );
    }
  }

  if (lastActivePart && order.status !== 'cancelled') {
    await service.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', order.id);
  }

  const refunded = propia ? Number(propia.total_amount) : cuenta.total;

  // Los avisos van solo la primera vez, no en un reintento.
  if (!yaCancelada) {
    const monto = `$${refunded.toLocaleString('es-CO')}`;
    await createNotification({
      type: 'order_part_cancelled',
      title: lastActivePart ? 'Tu pedido se canceló' : 'Una tienda no pudo cumplir tu pedido',
      message: lastActivePart
        ? `${storeName} no pudo cumplir el pedido ${order.code}. Te abonamos ${monto} como saldo a favor.`
        : `${storeName} no pudo cumplir su parte del pedido ${order.code}: ${reason} El resto sigue en camino y te abonamos ${monto} como saldo a favor.`,
      entityType: 'order',
      entityId: order.id,
      createdBy: params.actorId,
      recipientUserIds: [order.buyer_id],
    });

    await notifyRunnersOfOrder(
      order.id,
      lastActivePart ? 'Pedido cancelado' : 'Una tienda canceló su parte',
      lastActivePart
        ? `El pedido ${order.code} se canceló completo: ya no hay nada que recoger.`
        : `${storeName} canceló su parte del pedido ${order.code}. Recoge solo en las demás tiendas.`
    );
  }

  return { refunded, orderCancelled: lastActivePart };
}
