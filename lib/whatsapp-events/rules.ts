import { createHash } from 'node:crypto';
import { carrierOf, receiverOf, type ConsolidationConfig } from '@/lib/orders/consolidation';

/**
 * Las reglas de los avisos que Meteor consulta para enviar por WhatsApp. Puras:
 * sin base, para probarlas. La lectura está en `feed.ts`.
 */

export type AvisoTipo =
  | 'pedido_confirmado'
  | 'parte_estado'
  | 'domicilio_en_camino'
  | 'codigo_recogida'
  | 'domicilio_recogido';

/** A quién va el aviso, en el lenguaje de Meteor. */
export type RolDestinatario = 'comprador' | 'tendero' | 'logistica' | 'patinador';

/** La línea de WhatsApp desde la que escribe Meteor: compradores, o todos los demás. */
export function lineaFor(rol: RolDestinatario): 'compradores' | 'tenderos' {
  return rol === 'comprador' ? 'compradores' : 'tenderos';
}

/** Los avisos que van a quien entrega el paquete al mensajero, no al comprador. */
export const PICKUP_AVISOS = new Set<AvisoTipo>(['codigo_recogida']);

/**
 * Quién le entrega el paquete al mensajero, y por eso recibe el código de
 * recogida. Un pedido de una tienda lo entrega la tienda. Uno de varias tiendas
 * sale de la bahía: lo entrega logística si la plaza la tenía al crear el pedido;
 * si no, el patinador que dejó las partes; si no hay ninguno, los tenderos, que
 * las llevaron ellos mismos (`lib/orders/consolidation.ts`).
 */
export function pickupHandlerRole(
  fulfillment: string | null,
  cfg: ConsolidationConfig
): Exclude<RolDestinatario, 'comprador'> {
  if (fulfillment !== 'consolidated') return 'tendero';
  if (receiverOf(cfg) === 'logistics') return 'logistica';
  return carrierOf(cfg) === 'runner' ? 'patinador' : 'tendero';
}

/**
 * El `id` de un aviso que sale para varias personas (un evento, un aviso por
 * destinatario). Un UUID que siempre da lo mismo para el mismo par, para que
 * Meteor no lo envíe dos veces en un reintento, y que no deja ver el id de la
 * cuenta.
 */
export function avisoId(eventId: string, userId: string): string {
  const h = createHash('sha1').update(`${eventId}:${userId}`).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), `5${h.slice(13, 16)}`, ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join('-');
}

export interface EventRow {
  seq: number;
  id: string;
  event_type: AvisoTipo;
  order_id: string;
  store_order_id: string | null;
  status_to: string | null;
  created_at: string;
}

export const FEED_DEFAULT_LIMIT = 50;
export const FEED_MAX_LIMIT = 100;
/**
 * Solo se entregan los eventos con al menos este tiempo de creados. `seq` se
 * asigna al insertar, pero la fila se ve al confirmar la transacción: sin el
 * margen, un `seq` menor que se confirma un instante después que uno mayor
 * quedaría detrás del cursor de Meteor y no se entregaría nunca.
 */
export const VISIBILITY_DELAY_MS = 5_000;
/** La primera consulta (`desde=0`) trae solo lo de la última hora, no 7 días. */
export const FIRST_READ_WINDOW_MS = 60 * 60_000;

export type FeedQuery = { desde: number; limite: number };

export function parseFeedQuery(params: URLSearchParams): FeedQuery | { error: string } {
  const desdeRaw = params.get('desde') ?? '0';
  const limiteRaw = params.get('limite');
  if (!/^\d+$/.test(desdeRaw)) return { error: '`desde` debe ser el número que llegó en `siguiente`, o 0 la primera vez.' };
  if (limiteRaw !== null && !/^\d+$/.test(limiteRaw)) return { error: '`limite` debe ser un número entre 1 y 100.' };
  const limite = limiteRaw === null ? FEED_DEFAULT_LIMIT : Number(limiteRaw);
  if (limite < 1 || limite > FEED_MAX_LIMIT) return { error: '`limite` debe ser un número entre 1 y 100.' };
  return { desde: Number(desdeRaw), limite };
}

/** Qué eventos se pueden leer ahora: hasta `hasta`, y en la primera consulta desde hace una hora. */
export function feedWindow(desde: number, now: Date): { desdeFecha: string | null; hasta: string } {
  return {
    desdeFecha: desde === 0 ? new Date(now.getTime() - FIRST_READ_WINDOW_MS).toISOString() : null,
    hasta: new Date(now.getTime() - VISIBILITY_DELAY_MS).toISOString(),
  };
}

/**
 * El cursor que se le devuelve a Meteor. Avanza hasta el último evento leído,
 * se avise o no: uno que no se avisa no debe volver a leerse.
 */
export function nextCursor(desde: number, rows: Pick<EventRow, 'seq'>[]): number {
  return rows.reduce((max, r) => Math.max(max, Number(r.seq)), desde);
}

/**
 * En un pedido de varias tiendas sale un solo mensajero para todas. Avisar cada
 * parte que se empaca o se despacha serían hasta 18 mensajes por pedido: se
 * avisan la confirmación, el domicilio, la entrega (una sola, la base la junta)
 * y la cancelación o devolución de una parte.
 */
const CONSOLIDATED_SILENT = new Set(['packing', 'at_collection', 'dispatched']);

export function isNotifiable(ev: Pick<EventRow, 'event_type' | 'status_to'>, fulfillment: string | null): boolean {
  if (ev.event_type !== 'parte_estado') return true;
  if (fulfillment === 'consolidated') return !CONSOLIDATED_SILENT.has(ev.status_to ?? '');
  return true;
}

export interface Recipient {
  full_name: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  whatsapp_notifications: boolean;
  is_active: boolean;
}

/** Por qué no se le avisa a esta persona, o `null` si sí. Igual para compradores y tenderos. */
export function skipReason(r: Recipient | null): 'sin_cuenta' | 'sin_telefono_verificado' | 'avisos_apagados' | null {
  if (!r || !r.is_active) return 'sin_cuenta';
  if (!r.phone || !r.phone_verified_at) return 'sin_telefono_verificado';
  if (!r.whatsapp_notifications) return 'avisos_apagados';
  return null;
}
