import type { SupabaseClient } from '@supabase/supabase-js';
import { orderCodeFrom } from './buyer-orders';
import { PAYMENT_STATUS_LABELS } from './status-labels';

/**
 * El pago de un pedido del comprador y sus devoluciones, para contarlo por el
 * chat de Meteor (`estado_pago`).
 *
 * Sin datos financieros: ni tarjeta, ni banco, ni token ni referencia de
 * ZonaPagos, ni la referencia de una transferencia de devolución. Solo si el
 * pago quedó, en qué va y cuánto se devuelve y cómo.
 */

/** Qué hacer con cada estado del pago, dicho para el comprador. */
export const PAYMENT_STATUS_HELP: Record<string, string> = {
  pending:
    'El pago no se ha completado. Si el comprador ya pagó, la confirmación puede tardar unos minutos; si no, puede pagarlo con el botón «Pagar» de Mis órdenes en MercaMesa antes de que el pedido venza.',
  processing: 'El banco está confirmando el pago. Suele resolverse en minutos; no hay que volver a pagar.',
  approved: 'El pago está aprobado: el pedido sigue su curso.',
  rejected:
    'El banco rechazó el pago y no se cobró nada. El comprador puede intentarlo de nuevo con otro medio desde MercaMesa.',
  refunded: 'El pago se devolvió.',
  disputed: 'El pago tiene una disputa abierta con el banco. Lo revisa MercaMesa; ofrece hablar con una persona.',
};

export const REFUND_METHOD_LABELS: Record<string, string> = {
  credit: 'Saldo a favor en MercaMesa',
  money: 'Dinero a la cuenta del comprador',
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  credited: 'Abonado como saldo a favor',
  money_pending: 'En trámite: se le consigna el dinero',
  money_paid: 'Dinero consignado',
};

export interface PaymentOrderRow {
  code: string;
  payment_status: string;
  total: number;
  credit_applied: number;
}

export interface RefundRow {
  origin: string;
  total_amount: number;
  method: string;
  status: string;
  created_at: string;
  money_paid_at: string | null;
  store_orders: { code: string } | null;
  stores: { name: string } | null;
  pqrs: { code: string } | null;
}

export interface BuyerPaymentStatus {
  orderCode: string;
  status: string;
  statusLabel: string;
  help: string | null;
  total: number;
  creditApplied: number;
  refunds: {
    part: string | null;
    store: string | null;
    reason: 'caso' | 'cancelacion';
    caseCode: string | null;
    total: number;
    method: string;
    status: string;
    statusLabel: string;
    createdAt: string;
    moneyPaidAt: string | null;
  }[];
  /** Hay una devolución en dinero que todavía no se consigna. */
  refundInProgress: boolean;
}

/** Arma la respuesta con lo leído. Sin base. */
export function toPaymentStatus(order: PaymentOrderRow, refunds: RefundRow[]): BuyerPaymentStatus {
  const lista = refunds
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({
      part: r.store_orders?.code ?? null,
      store: r.stores?.name ?? null,
      reason: (r.origin === 'store_cancel' ? 'cancelacion' : 'caso') as 'caso' | 'cancelacion',
      caseCode: r.pqrs?.code ?? null,
      total: Number(r.total_amount),
      method: REFUND_METHOD_LABELS[r.method] ?? r.method,
      status: r.status,
      statusLabel: REFUND_STATUS_LABELS[r.status] ?? r.status,
      createdAt: r.created_at,
      moneyPaidAt: r.money_paid_at,
    }));

  return {
    orderCode: order.code,
    status: order.payment_status,
    statusLabel: PAYMENT_STATUS_LABELS[order.payment_status as keyof typeof PAYMENT_STATUS_LABELS] ?? order.payment_status,
    help: PAYMENT_STATUS_HELP[order.payment_status] ?? null,
    total: Number(order.total),
    creditApplied: Number(order.credit_applied ?? 0),
    refunds: lista,
    refundInProgress: lista.some((r) => r.status === 'money_pending'),
  };
}

/**
 * El pago de un pedido del comprador, por el código del pedido o de una parte.
 * `null` si no existe o no es suyo: las dos cosas se responden igual.
 */
export async function getBuyerPaymentStatus(
  service: SupabaseClient<any>,
  buyerId: string,
  code: string
): Promise<BuyerPaymentStatus | null> {
  const orderCode = orderCodeFrom(code);
  if (!orderCode) return null;

  const { data: order, error } = await service
    .from('orders')
    .select('id, code, payment_status, total, credit_applied')
    .eq('buyer_id', buyerId)
    .eq('code', orderCode)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  if (!order) return null;

  const { data: refunds, error: refundsError } = await service
    .from('order_refunds')
    .select(
      'origin, total_amount, method, status, created_at, money_paid_at, store_orders ( code ), stores ( name ), pqrs ( code )'
    )
    .eq('order_id', order.id)
    .eq('buyer_id', buyerId);
  if (refundsError) throw new Error(`No se pudieron leer las devoluciones: ${refundsError.message}`);

  return toPaymentStatus(order as PaymentOrderRow, (refunds ?? []) as unknown as RefundRow[]);
}
