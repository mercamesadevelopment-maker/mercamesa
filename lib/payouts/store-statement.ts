import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { calcularElegibilidad, EXPLICACION_DESCARTE, type RazonDescarte } from './build-draft';

/**
 * El estado de cuenta de una tienda para el chat del tendero
 * (`liquidacion_del_tendero`): lo vendido, lo pagado y lo que viene.
 *
 * Lo pendiente sale de `calcularElegibilidad`, la misma regla del borrador de
 * los martes y jueves: el tendero ve exactamente lo que se le va a pagar y, de
 * lo que no, por qué.
 *
 * A la tienda se le paga el valor de sus productos (`store_orders.subtotal`):
 * lo de MercaMesa (domicilio y gastos) lo paga el comprador aparte. El sistema
 * no calcula retenciones: no se inventan.
 */

/** Los días en que se arma la liquidación (`cron.schedule('payouts_draft', '0 11 * * 2,4')`): martes y jueves. */
const DIAS_DE_LIQUIDACION = [2, 4];

/** La próxima fecha de liquidación, en hora de Colombia, como `YYYY-MM-DD`. Hoy cuenta si es martes o jueves. */
export function nextPayoutDate(now: Date = new Date()): string {
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  for (let i = 0; i < 7; i++) {
    const d = new Date(bogota.getTime() + i * 24 * 60 * 60 * 1000);
    if (DIAS_DE_LIQUIDACION.includes(d.getUTCDay())) return d.toISOString().slice(0, 10);
  }
  return bogota.toISOString().slice(0, 10);
}

export interface StoreStatement {
  from: string;
  to: string;
  sold: { orders: number; amount: number };
  paid: { amount: number; payouts: { date: string | null; amount: number }[] };
  nextPayout: {
    date: string;
    amount: number;
    orders: number;
    discounts: number;
  };
  held: { reason: string; explanation: string; orders: number; amount: number }[];
  withholdings: null;
  note: string;
}

/** Agrupa lo retenido por razón. Sin base. */
export function groupHeld(descartados: { reason: RazonDescarte; amount: number }[]) {
  const porRazon = new Map<RazonDescarte, { orders: number; amount: number }>();
  for (const d of descartados) {
    const g = porRazon.get(d.reason) ?? { orders: 0, amount: 0 };
    g.orders += 1;
    g.amount += d.amount;
    porRazon.set(d.reason, g);
  }
  return [...porRazon.entries()].map(([reason, g]) => ({ reason, explanation: EXPLICACION_DESCARTE[reason], ...g }));
}

export async function loadStoreStatement(
  service: SupabaseClient<any>,
  storeId: string,
  range: { from: string; to: string }
): Promise<StoreStatement> {
  const hasta = `${range.to}T23:59:59.999-05:00`;
  const desde = `${range.from}T00:00:00-05:00`;

  const [vendidos, pagos, elegibilidad] = await Promise.all([
    fetchAllRows<any>((from, to) =>
      service
        .from('store_orders')
        .select('subtotal, orders!inner ( payment_status, client_id )')
        .eq('store_id', storeId)
        .eq('status', 'delivered')
        .eq('orders.payment_status', 'approved')
        .is('orders.client_id', null)
        .gte('created_at', desde)
        .lte('created_at', hasta)
        .range(from, to)
    ),
    fetchAllRows<any>((from, to) =>
      service
        .from('payout_items')
        .select('amount, payout_id, payouts!inner ( status, approved_at )')
        .eq('store_id', storeId)
        .eq('payouts.status', 'approved')
        .gte('payouts.approved_at', desde)
        .lte('payouts.approved_at', hasta)
        .range(from, to)
    ),
    calcularElegibilidad(service, storeId),
  ]);

  const porPago = new Map<string, { date: string | null; amount: number }>();
  for (const i of pagos) {
    const p = porPago.get(i.payout_id) ?? { date: i.payouts?.approved_at ?? null, amount: 0 };
    p.amount += Number(i.amount);
    porPago.set(i.payout_id, p);
  }

  const descuentos = elegibilidad.cargos.reduce((s, c) => s + c.amount, 0);

  return {
    from: range.from,
    to: range.to,
    sold: { orders: vendidos.length, amount: vendidos.reduce((s, v) => s + Number(v.subtotal ?? 0), 0) },
    paid: {
      amount: [...porPago.values()].reduce((s, p) => s + p.amount, 0),
      payouts: [...porPago.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    },
    nextPayout: {
      date: nextPayoutDate(),
      amount: elegibilidad.total,
      orders: elegibilidad.elegibles.length,
      discounts: descuentos,
    },
    held: groupHeld(elegibilidad.descartados),
    withholdings: null,
    note:
      'A la tienda se le paga el valor de sus productos; el domicilio y los gastos de MercaMesa los paga el comprador aparte. ' +
      'La liquidación se arma los martes y jueves y se paga cuando MercaMesa la aprueba. Este cálculo no incluye retenciones.',
  };
}
