import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { loadPayoutSettings, type PayoutSettings } from './settings';

/**
 * Qué pedidos se le pueden pagar a las tiendas, y cuáles no y por qué.
 *
 * Es la ÚNICA fuente de elegibilidad: la usan el botón de la pantalla y el
 * trabajo de los martes y jueves. Si cada uno tuviera su propia consulta, un día
 * el borrador automático y el manual tomarían pedidos distintos.
 *
 * Devuelve también los descartados con su razón. Un pedido que no aparece por
 * ningún lado parece un error del sistema; uno que aparece diciendo "la tienda
 * no tiene cuenta verificada" es una tarea para alguien.
 */

/** Un pedido listo para pagar. */
export interface PedidoElegible {
  storeOrderId: string;
  storeOrderCode: string | null;
  storeId: string;
  storeName: string;
  amount: number;
  deliveredAt: string | null;
  bankAccountId: string;
}

export type RazonDescarte =
  | 'sin_cuenta_verificada'
  | 'en_espera'
  | 'sin_factura'
  | 'pqrs_abierta'
  | 'sin_monto';

export const EXPLICACION_DESCARTE: Record<RazonDescarte, string> = {
  sin_cuenta_verificada: 'La tienda no tiene una cuenta bancaria verificada',
  en_espera: 'Entregado hace muy poco; sigue en el periodo de espera',
  sin_factura: 'La factura electrónica todavía no se ha emitido',
  pqrs_abierta: 'Tiene una PQRS sin resolver',
  sin_monto: 'El pedido no tiene valor que pagar',
};

export interface PedidoDescartado {
  storeOrderId: string;
  storeOrderCode: string | null;
  storeName: string;
  amount: number;
  reason: RazonDescarte;
}

/**
 * Un descuento a una tienda por una devolución que asume, que cabe en lo que se
 * le va a pagar ahora. Entra a la liquidación como una línea negativa.
 */
export interface CargoAplicado {
  chargeId: string;
  storeId: string;
  storeName: string;
  amount: number;
  /** El pedido del que salió la devolución. */
  storeOrderCode: string | null;
  bankAccountId: string;
}

export interface Elegibilidad {
  settings: PayoutSettings;
  elegibles: PedidoElegible[];
  descartados: PedidoDescartado[];
  /** Descuentos que se aplican en esta liquidación. */
  cargos: CargoAplicado[];
  /** Lo que de verdad se paga: pedidos menos descuentos. */
  total: number;
}

/**
 * Reúne lo dispersable a día de hoy.
 *
 * Las cinco condiciones, y por qué cada una:
 *
 *   1. El pedido está `delivered`. Es el único estado terminal con éxito; no
 *      existe "finalizado" en el sistema.
 *   2. El comprador pagó (`payment_status = 'approved'`). Pagarle a la tienda
 *      por algo que nadie pagó sería sacar plata de la plataforma.
 *   3. No es venta de mostrador (`client_id` nulo): ahí el tendero ya recibió el
 *      dinero en su local.
 *   4. Pasó el periodo de espera desde la entrega. Es el único colchón contra
 *      una devolución, porque el sistema no tiene flujo de devoluciones y un
 *      pedido entregado sí se puede pasar a `returned` a mano.
 *   5. La factura electrónica ya salió, y la tienda tiene cuenta verificada.
 *   6. No tiene una PQRS abierta. Pagar un pedido que está en reclamo obligaría
 *      a cobrárselo de vuelta a la tienda si el reclamo se aprueba.
 *
 * Y a lo elegible se le restan los descuentos pendientes de cada tienda: las
 * devoluciones que asumió. Un descuento solo entra si cabe en lo que se le paga
 * ahora; si no, espera a la siguiente liquidación. Una tienda nunca queda con
 * saldo negativo en el archivo.
 *
 * El "no está ya en otra liquidación" no se comprueba acá por gusto sino porque
 * es barato: la garantía de verdad es el índice único sobre
 * `payout_items.store_order_id`, que aguanta incluso dos procesos a la vez.
 */
export async function calcularElegibilidad(
  service: SupabaseClient<any>
): Promise<Elegibilidad> {
  const settings = await loadPayoutSettings(service);

  // Los pedidos entregados de compras pagadas que no son de mostrador. El
  // `!inner` es lo que convierte el filtro sobre `orders` en un join de verdad.
  const entregados = await fetchAllRows<any>((from, to) =>
    service
      .from('store_orders')
      .select(
        `id, code, store_id, subtotal, order_id,
         stores!inner ( id, name ),
         orders!inner ( id, payment_status, client_id )`
      )
      .eq('status', 'delivered')
      .eq('orders.payment_status', 'approved')
      .is('orders.client_id', null)
      .range(from, to)
  );

  if (entregados.length === 0) {
    return { settings, elegibles: [], descartados: [], cargos: [], total: 0 };
  }

  const storeOrderIds = entregados.map((so) => so.id);
  const orderIds = Array.from(new Set(entregados.map((so) => so.order_id)));
  const storeIds = Array.from(new Set(entregados.map((so) => so.store_id)));

  // Lo que ya se pagó (o está en un borrador vivo). Los ítems de una liquidación
  // cancelada se borran, así que esos pedidos vuelven a estar disponibles.
  const yaLiquidados = new Set(
    (
      await fetchAllRows<any>((from, to) =>
        service.from('payout_items').select('store_order_id').in('store_order_id', storeOrderIds).range(from, to)
      )
    ).map((i) => i.store_order_id)
  );

  // Cuándo se entregó de verdad. `store_orders.updated_at` se mueve por
  // cualquier cambio, así que el periodo de espera se cuenta desde el registro
  // del cambio de estado, que es la fecha real.
  const historial = await fetchAllRows<any>((from, to) =>
    service
      .from('store_order_status_history')
      .select('store_order_id, created_at')
      .eq('status', 'delivered')
      .in('store_order_id', storeOrderIds)
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  const entregadoEn = new Map<string, string>();
  for (const h of historial) {
    if (!entregadoEn.has(h.store_order_id)) entregadoEn.set(h.store_order_id, h.created_at);
  }

  const facturadas = new Set(
    (
      await fetchAllRows<any>((from, to) =>
        service.from('siigo_invoices').select('order_id').eq('status', 'sent').in('order_id', orderIds).range(from, to)
      )
    ).map((f) => f.order_id)
  );

  const cuentas = await fetchAllRows<any>((from, to) =>
    service
      .from('store_bank_accounts')
      .select('id, store_id')
      .eq('status', 'verified')
      .eq('is_current', true)
      .in('store_id', storeIds)
      .range(from, to)
  );
  const cuentaDe = new Map<string, string>(cuentas.map((c) => [c.store_id, c.id]));

  const enReclamo = new Set(
    (
      await fetchAllRows<any>((from, to) =>
        service
          .from('pqrs')
          .select('store_order_id')
          .neq('status', 'resolved')
          .in('store_order_id', storeOrderIds)
          .range(from, to)
      )
    ).map((p) => p.store_order_id)
  );

  const limite = Date.now() - settings.holdDays * 24 * 60 * 60 * 1000;

  const elegibles: PedidoElegible[] = [];
  const descartados: PedidoDescartado[] = [];

  for (const so of entregados) {
    if (yaLiquidados.has(so.id)) continue; // Ya pagado: ni elegible ni descartado.

    const storeName = so.stores?.name ?? 'Tienda';
    const amount = Number(so.subtotal ?? 0);
    const base = { storeOrderId: so.id, storeOrderCode: so.code, storeName, amount };

    if (amount <= 0) {
      descartados.push({ ...base, reason: 'sin_monto' });
      continue;
    }

    // El orden importa: se reporta el primer motivo, y conviene que sea el que
    // alguien puede resolver. Esperar se resuelve solo; verificar una cuenta y
    // emitir una factura, no.
    if (!cuentaDe.has(so.store_id)) {
      descartados.push({ ...base, reason: 'sin_cuenta_verificada' });
      continue;
    }

    if (!facturadas.has(so.order_id)) {
      descartados.push({ ...base, reason: 'sin_factura' });
      continue;
    }

    if (enReclamo.has(so.id)) {
      descartados.push({ ...base, reason: 'pqrs_abierta' });
      continue;
    }

    const deliveredAt = entregadoEn.get(so.id) ?? null;
    // Sin registro del cambio de estado no se puede saber cuándo se entregó, y
    // adivinar acortaría el colchón. Se deja esperando.
    if (!deliveredAt || new Date(deliveredAt).getTime() > limite) {
      descartados.push({ ...base, reason: 'en_espera' });
      continue;
    }

    elegibles.push({
      ...base,
      storeId: so.store_id,
      deliveredAt,
      bankAccountId: cuentaDe.get(so.store_id)!,
    });
  }

  const cargos = await cargosQueCaben(service, elegibles);

  return {
    settings,
    elegibles,
    descartados,
    cargos,
    total:
      elegibles.reduce((suma, e) => suma + e.amount, 0) - cargos.reduce((suma, c) => suma + c.amount, 0),
  };
}

/**
 * Los descuentos pendientes de las tiendas a las que se les va a pagar, hasta
 * donde quepan.
 *
 * «Pendiente» es: no anulado y sin línea en ninguna liquidación. Cancelar un
 * borrador borra sus líneas, así que sus descuentos vuelven a estar pendientes
 * sin que nadie tenga que acordarse de liberarlos.
 */
async function cargosQueCaben(
  service: SupabaseClient<any>,
  elegibles: PedidoElegible[]
): Promise<CargoAplicado[]> {
  if (elegibles.length === 0) return [];

  const disponible = new Map<string, number>();
  const tienda = new Map<string, PedidoElegible>();
  for (const e of elegibles) {
    disponible.set(e.storeId, (disponible.get(e.storeId) ?? 0) + e.amount);
    tienda.set(e.storeId, e);
  }

  const pendientes = (
    await fetchAllRows<any>((from, to) =>
      service
        .from('store_charges')
        .select('id, store_id, amount, created_at, store_orders ( code ), payout_items ( id )')
        .is('voided_at', null)
        .in('store_id', Array.from(disponible.keys()))
        .order('created_at', { ascending: true })
        .range(from, to)
    )
  ).filter((c) => (c.payout_items ?? []).length === 0);

  const cargos: CargoAplicado[] = [];
  for (const c of pendientes) {
    const amount = Number(c.amount);
    const queda = disponible.get(c.store_id) ?? 0;
    // El que no cabe espera; uno más pequeño y posterior sí puede entrar.
    if (amount > queda) continue;

    disponible.set(c.store_id, queda - amount);
    const ref = tienda.get(c.store_id)!;
    cargos.push({
      chargeId: c.id,
      storeId: c.store_id,
      storeName: ref.storeName,
      amount,
      storeOrderCode: c.store_orders?.code ?? null,
      bankAccountId: ref.bankAccountId,
    });
  }

  return cargos;
}

export class SinPedidosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SinPedidosError';
  }
}

export interface BorradorCreado {
  payoutId: string;
  itemsCount: number;
  storesCount: number;
  totalAmount: number;
  descartados: PedidoDescartado[];
}

/**
 * Crea el borrador. No genera el archivo: eso pasa al aprobarlo.
 *
 * `scheduledFor` es la fecha en que el banco procesará el archivo, y por defecto
 * es hoy porque el archivo se sube el mismo día que se genera.
 */
export async function construirBorrador(
  service: SupabaseClient<any>,
  opciones: { scheduledFor?: string; generatedBy?: string | null } = {}
): Promise<BorradorCreado> {
  const { settings, elegibles, descartados, cargos, total } = await calcularElegibilidad(service);

  if (elegibles.length === 0) {
    throw new SinPedidosError(
      'No hay pedidos por dispersar en este momento.'
    );
  }

  // Todo lo que habría por pagar se compensa con devoluciones: no hay archivo
  // que subir al banco. Los pedidos quedan para la siguiente liquidación.
  if (total <= 0) {
    throw new SinPedidosError(
      'Lo que hay por dispersar se compensa con descuentos por devoluciones: no queda nada que pagar todavía.'
    );
  }

  const { data: payout, error: payoutError } = await service
    .from('payouts')
    .insert({
      status: 'draft',
      scheduled_for: opciones.scheduledFor ?? new Date().toISOString().slice(0, 10),
      settings_id: settings.id,
      total_amount: total,
      items_count: elegibles.length,
      generated_by: opciones.generatedBy ?? null,
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (payoutError || !payout) {
    throw new Error(`No se pudo crear la liquidación: ${payoutError?.message}`);
  }

  const { error: itemsError } = await service.from('payout_items').insert([
    ...elegibles.map((e) => ({
      payout_id: payout.id,
      store_order_id: e.storeOrderId,
      store_charge_id: null,
      store_id: e.storeId,
      bank_account_id: e.bankAccountId,
      amount: e.amount,
    })),
    // Cada descuento es una línea negativa de la misma tienda: el pedido se ve
    // pagado completo y el descuento aparte, con su propio rastro.
    ...cargos.map((c) => ({
      payout_id: payout.id,
      store_order_id: null,
      store_charge_id: c.chargeId,
      store_id: c.storeId,
      bank_account_id: c.bankAccountId,
      amount: -c.amount,
    })),
  ]);

  // Si los ítems fallan —típicamente porque otro proceso tomó los mismos
  // pedidos y el índice único lo frenó— la liquidación se borra entera. Una
  // liquidación vacía o a medias es peor que ninguna: aparece en la lista como
  // si algo se hubiera pagado.
  if (itemsError) {
    await service.from('payouts').delete().eq('id', payout.id);
    throw new Error(
      itemsError.message.includes('payout_items_store_order_unico') ||
        itemsError.message.includes('payout_items_store_charge_unico')
        ? 'Otra liquidación tomó estos pedidos mientras se armaba esta. Vuelve a intentarlo.'
        : `No se pudieron registrar los pedidos: ${itemsError.message}`
    );
  }

  return {
    payoutId: payout.id,
    itemsCount: elegibles.length,
    storesCount: new Set(elegibles.map((e) => e.storeId)).size,
    totalAmount: total,
    descartados,
  };
}
