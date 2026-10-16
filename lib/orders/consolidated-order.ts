import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildBookingPayload,
  createBooking,
  isPiboxEnabled,
  loadOrderBookingContext,
  PiboxDataError,
} from '@/lib/pibox';
import { persistBookingSnapshot } from '@/lib/pibox/services/sync.service';
import { readyForCourier, type ConsolidationConfig, type ConsolidationPart } from './consolidation';

/**
 * Un pedido de varias tiendas, leído para decidir qué sigue: las reglas están
 * en `consolidation.ts`; acá solo se lee la base y se pide el mensajero.
 *
 * Todo espera el cliente de servicio: quien llama ya comprobó quién pregunta.
 */

export interface ConsolidatedPart extends ConsolidationPart {
  id: string;
  code: string;
  storeId: string;
  storeName: string;
  /** «Local 234, pasillo 3»: dónde encontrar la tienda en la plaza. */
  localAddress: string | null;
  packingNotes: string | null;
  subtotal: number;
  splitIndex: number;
}

export interface ConsolidatedOrder {
  id: string;
  code: string;
  createdAt: string;
  fulfillment: 'store' | 'consolidated';
  paymentStatus: string;
  config: ConsolidationConfig;
  bayReadyAt: string | null;
  bayReadyBy: string | null;
  commission: {
    type: 'percent' | 'fixed' | null;
    value: number | null;
    amount: number | null;
  };
  marketplaceId: string | null;
  marketplaceName: string | null;
  buyerName: string | null;
  parts: ConsolidatedPart[];
}

export const CONSOLIDATED_ORDER_SELECT = `
  id, code, created_at, fulfillment, payment_status,
  runner_required, logistics_required, bay_ready_at, bay_ready_by,
  runner_commission_type, runner_commission_value, runner_commission_amount,
  profiles ( full_name ),
  store_orders (
    id, code, status, subtotal, split_index, store_id, packing_notes,
    collected_at, bay_received_at,
    stores ( name, local_address, marketplace_id, marketplaces ( name ) )
  )
`;

export function toConsolidatedOrder(o: any): ConsolidatedOrder {
  const partes = [...(o.store_orders ?? [])].sort((a: any, b: any) => a.split_index - b.split_index);
  const primera = partes[0]?.stores;

  return {
    id: o.id,
    code: o.code,
    createdAt: o.created_at,
    fulfillment: o.fulfillment,
    paymentStatus: o.payment_status,
    config: { runnerRequired: Boolean(o.runner_required), logisticsRequired: Boolean(o.logistics_required) },
    bayReadyAt: o.bay_ready_at ?? null,
    bayReadyBy: o.bay_ready_by ?? null,
    commission: {
      type: o.runner_commission_type ?? null,
      value: o.runner_commission_value == null ? null : Number(o.runner_commission_value),
      amount: o.runner_commission_amount == null ? null : Number(o.runner_commission_amount),
    },
    marketplaceId: primera?.marketplace_id ?? null,
    marketplaceName: primera?.marketplaces?.name ?? null,
    buyerName: o.profiles?.full_name ?? null,
    parts: partes.map((p: any) => ({
      id: p.id,
      code: p.code,
      status: p.status,
      storeId: p.store_id,
      storeName: p.stores?.name ?? 'Tienda',
      localAddress: p.stores?.local_address ?? null,
      packingNotes: p.packing_notes ?? null,
      subtotal: Number(p.subtotal || 0),
      splitIndex: p.split_index,
      collectedAt: p.collected_at ?? null,
      bayReceivedAt: p.bay_received_at ?? null,
    })),
  };
}

export async function loadConsolidatedOrder(
  service: SupabaseClient<any>,
  orderId: string
): Promise<ConsolidatedOrder | null> {
  const { data, error } = await service.from('orders').select(CONSOLIDATED_ORDER_SELECT).eq('id', orderId).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el pedido: ${error.message}`);
  return data ? toConsolidatedOrder(data) : null;
}

/** La reserva vigente del pedido entero, si hay. */
export async function activeOrderBooking(service: SupabaseClient<any>, orderId: string): Promise<any | null> {
  const { data } = await service
    .from('pibox_bookings')
    .select('*')
    .eq('order_id', orderId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export interface CourierOutcome {
  /** Quedó un mensajero pedido (ahora o desde antes). */
  requested: boolean;
  /** Por qué no se pudo, para mostrárselo a quien tocó el botón. */
  error: string | null;
}

/**
 * Pide el mensajero del pedido entero si las reglas dicen que ya toca.
 *
 * Pedirlo dos veces no manda dos mensajeros: si ya hay una reserva vigente no
 * hace nada. Un fallo de Pibox no deshace lo que hizo quien llamó (recibir,
 * recoger, marcar listo): queda en el histórico y se puede reintentar.
 *
 * `contactPhone` es a quién llama el mensajero al llegar a la plaza: quien
 * tiene el pedido en la bahía.
 */
export async function requestCourierIfReady(
  service: SupabaseClient<any>,
  orderId: string,
  contactPhone: string | null,
  actorId: string | null
): Promise<CourierOutcome> {
  const order = await loadConsolidatedOrder(service, orderId);
  if (!order || order.fulfillment !== 'consolidated' || order.paymentStatus !== 'approved') {
    return { requested: false, error: null };
  }
  if (!readyForCourier(order.config, order.parts, Boolean(order.bayReadyAt))) {
    return { requested: false, error: null };
  }
  if (await activeOrderBooking(service, orderId)) return { requested: true, error: null };

  // Con la integración apagada no hay a quién pedirle el mensajero: el pedido
  // queda en la bahía y se despacha por fuera.
  if (!isPiboxEnabled()) return { requested: false, error: null };

  try {
    const context = await loadOrderBookingContext(service, orderId, contactPhone);
    const booking = await createBooking(buildBookingPayload(context));
    await persistBookingSnapshot({ orderId }, booking);
    return { requested: true, error: null };
  } catch (error: unknown) {
    const message =
      error instanceof PiboxDataError
        ? error.message
        : `No se pudo pedir el mensajero: ${error instanceof Error ? error.message : 'error desconocido'}`;
    console.error(`No se pudo pedir el mensajero del pedido ${orderId}:`, error);

    const activas = order.parts.filter((p) => !['cancelled', 'returned'].includes(p.status));
    if (activas.length > 0) {
      await service.from('store_order_status_history').insert(
        activas.map((p) => ({
          store_order_id: p.id,
          status: p.status,
          notes: `No se pudo solicitar el domicilio: ${message}`,
          changed_by: actorId,
        }))
      );
    }
    return { requested: false, error: message };
  }
}

/**
 * Lo que un pedido nuevo copia de su plaza.
 *
 * Con una tienda, nada: la tienda pide su mensajero como siempre. Con varias,
 * cómo opera la plaza hoy (patinador, logística, comisión). Se copia para que un
 * cambio de configuración no afecte a los pedidos que ya están en curso.
 */
export async function fulfillmentSnapshot(
  client: SupabaseClient<any>,
  storeId: string,
  storeCount: number
): Promise<Record<string, unknown>> {
  if (storeCount <= 1) return { fulfillment: 'store' };

  const { data } = await client
    .from('stores')
    .select(
      'marketplaces ( runner_enabled, logistics_enabled, runner_commission_type, runner_commission_value )'
    )
    .eq('id', storeId)
    .maybeSingle();
  const plaza = (data as any)?.marketplaces;
  const conPatinador = Boolean(plaza?.runner_enabled);

  return {
    fulfillment: 'consolidated',
    runner_required: conPatinador,
    logistics_required: Boolean(plaza?.logistics_enabled),
    runner_commission_type: conPatinador ? plaza?.runner_commission_type ?? null : null,
    runner_commission_value: conPatinador ? plaza?.runner_commission_value ?? null : null,
  };
}
