import { canReceivePart, type ConsolidationConfig } from '@/lib/orders/consolidation';

/**
 * Las reglas de la recepción en la bahía: cuándo logística puede registrarla,
 * hasta cuándo puede completar la evidencia y qué tiene que traer.
 *
 * - Para recibir hace falta al menos una foto de los productos y las bolsas.
 * - Si algo llegó en mal estado, la observación es obligatoria: es lo que le
 *   dice al tendero qué pasó.
 * - Mientras la parte siga en la plaza se pueden agregar fotos y cambiar la
 *   observación. Cuando sale con el domiciliario queda como está.
 */

export const RECEPTION_MAX_PHOTOS = 6;
export const RECEPTION_OBSERVATION_MAX = 500;

/** Estados en los que la parte ya no está en la plaza. */
const FUERA_DE_LA_PLAZA = ['dispatched', 'delivered', 'cancelled', 'returned'];

export interface ReceptionPart {
  status: string;
  collectedAt: string | null;
  bayReceivedAt: string | null;
}

export interface ReceptionOrder {
  consolidated: boolean;
  config: ConsolidationConfig;
  /** La plaza tiene logística hoy. Cuenta para los pedidos de una sola tienda. */
  marketplaceHasLogistics: boolean;
}

/**
 * Si logística puede registrar ahora la recepción de la parte.
 *
 * En un pedido de varias tiendas son las reglas de siempre (`canReceivePart`).
 * En uno de una sola tienda, cuando la tienda ya la dejó lista y la plaza tiene
 * logística: ahí es solo evidencia, el despacho no la espera.
 */
export function canRecordReception(part: ReceptionPart, order: ReceptionOrder): boolean {
  if (part.bayReceivedAt) return false;
  if (order.consolidated) return canReceivePart(part, order.config);
  return order.marketplaceHasLogistics && part.status === 'at_collection';
}

/** Si a una parte ya recibida todavía se le pueden agregar fotos o cambiar la observación. */
export function canEditEvidence(part: ReceptionPart): boolean {
  return Boolean(part.bayReceivedAt) && !FUERA_DE_LA_PLAZA.includes(part.status);
}

export interface ReceptionInput {
  photos: string[];
  observation: string | null;
  damaged: boolean;
}

/**
 * Lee y valida lo que manda la pantalla. `firstTime` es recibir; si no, es
 * completar la evidencia de una parte ya recibida.
 */
export function parseReceptionInput(
  body: unknown,
  { firstTime }: { firstTime: boolean }
): { input: ReceptionInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const photos = Array.isArray(b.photos) ? b.photos : [];
  if (!photos.every((p) => typeof p === 'string')) return { error: 'Una de las fotos no es válida. Vuelve a adjuntarla.' };
  if (photos.length > RECEPTION_MAX_PHOTOS) return { error: `Puedes adjuntar hasta ${RECEPTION_MAX_PHOTOS} fotos a la vez.` };
  if (firstTime && photos.length === 0) {
    return { error: 'Toma al menos una foto de cómo recibiste los productos y las bolsas.' };
  }

  const observation = typeof b.observation === 'string' ? b.observation.trim() : '';
  if (observation.length > RECEPTION_OBSERVATION_MAX) {
    return { error: `La observación puede tener máximo ${RECEPTION_OBSERVATION_MAX} caracteres.` };
  }

  const damaged = b.damaged === true;
  if (damaged && !observation) return { error: 'Cuenta qué llegó en mal estado.' };

  return { input: { photos: photos as string[], observation: observation || null, damaged } };
}
