import { receiverOf, type ConsolidationConfig } from './consolidation';

/**
 * Cuándo la evidencia del pedido (fotos de los productos y las bolsas) la deja
 * el tendero al marcar «Listo Recogida».
 *
 * La evidencia la registra logística al recibir la parte en la bahía
 * (`lib/logistics/reception-rules.ts`). Cuando nadie de logística la va a
 * recibir —la plaza no tiene logística, el pedido de varias tiendas no la usa o
 * la tienda despacha desde su propia dirección—, la deja el tendero, y es
 * obligatoria: sin al menos una foto no se marca «Listo Recogida».
 */

export const STORE_EVIDENCE_MAX_PHOTOS = 6;
export const STORE_OBSERVATION_MAX = 500;
export const STORE_EVIDENCE_REQUIRED_MESSAGE =
  'Toma al menos una foto de los productos y las bolsas antes de marcar «Listo Recogida».';

export interface StoreEvidenceContext {
  consolidated: boolean;
  /** La configuración que copió el pedido al crearse (solo cuenta en los de varias tiendas). */
  config: ConsolidationConfig;
  /** La plaza tiene logística hoy (`marketplaces.logistics_enabled`). */
  marketplaceHasLogistics: boolean;
  /** La tienda despacha desde su propia dirección y no desde la bahía de la plaza. */
  ownPickup: boolean;
}

export function storeMustPhotograph(ctx: StoreEvidenceContext): boolean {
  if (ctx.consolidated) return receiverOf(ctx.config) !== 'logistics';
  if (ctx.ownPickup) return true;
  return !ctx.marketplaceHasLogistics;
}

export interface StoreEvidenceInput {
  photos: string[];
  observation: string | null;
}

/** Lee lo que manda la pantalla con el cambio de estado. No exige fotos: eso lo decide quien llama. */
export function parseStoreEvidenceInput(body: unknown): { input: StoreEvidenceInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const photos = Array.isArray(b.photos) ? b.photos : [];
  if (!photos.every((p) => typeof p === 'string')) return { error: 'Una de las fotos no es válida. Vuelve a adjuntarla.' };
  if (photos.length > STORE_EVIDENCE_MAX_PHOTOS) return { error: `Puedes adjuntar hasta ${STORE_EVIDENCE_MAX_PHOTOS} fotos.` };

  const observation = typeof b.observation === 'string' ? b.observation.trim() : '';
  if (observation.length > STORE_OBSERVATION_MAX) {
    return { error: `La observación puede tener máximo ${STORE_OBSERVATION_MAX} caracteres.` };
  }
  return { input: { photos: photos as string[], observation: observation || null } };
}
