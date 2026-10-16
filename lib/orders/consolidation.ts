/**
 * Cómo sale un pedido de varias tiendas (`orders.fulfillment = 'consolidated'`).
 *
 * Las partes se juntan en la bahía de la plaza y de ahí sale un solo
 * mensajero. Quién las lleva y quién las recibe depende de lo que la plaza
 * tenía al crear el pedido (`orders.runner_required`, `logistics_required`):
 *
 *   | Plaza                 | Lleva cada parte | La recibe     | Se pide el mensajero cuando…        |
 *   |-----------------------|------------------|---------------|-------------------------------------|
 *   | patinador + logística | el patinador     | logística     | logística recibió todas las partes  |
 *   | solo logística        | el tendero       | logística     | logística recibió todas las partes  |
 *   | solo patinador        | el patinador     | domiciliario  | el patinador las dejó en la bahía   |
 *   | ninguno               | el tendero       | domiciliario  | todas las tiendas tienen lista la suya |
 *
 * Funciones puras, sin red ni base: las usan las rutas del tendero, del
 * patinador y de logística, para que las tres decidan igual.
 */

export interface ConsolidationConfig {
  runnerRequired: boolean;
  logisticsRequired: boolean;
}

export interface ConsolidationPart {
  status: string;
  collectedAt: string | null;
  bayReceivedAt: string | null;
}

/** Estados en los que una parte ya no viaja con el pedido. */
const FUERA = ['cancelled', 'returned'];

/** Quién lleva cada parte hasta la bahía. */
export function carrierOf(cfg: ConsolidationConfig): 'runner' | 'store' {
  return cfg.runnerRequired ? 'runner' : 'store';
}

/** A quién se le entrega cada parte en la bahía. */
export function receiverOf(cfg: ConsolidationConfig): 'logistics' | 'courier' {
  return cfg.logisticsRequired ? 'logistics' : 'courier';
}

export function activeParts<T extends { status: string }>(parts: T[]): T[] {
  return parts.filter((p) => !FUERA.includes(p.status));
}

/** La tienda ya la tiene lista y, si hay patinador, él ya la recogió. */
export function partReachedBay(part: ConsolidationPart, cfg: ConsolidationConfig): boolean {
  if (part.status !== 'at_collection') return false;
  return cfg.runnerRequired ? Boolean(part.collectedAt) : true;
}

/** Logística puede marcar esta parte como recibida. */
export function canReceivePart(part: ConsolidationPart, cfg: ConsolidationConfig): boolean {
  return cfg.logisticsRequired && !part.bayReceivedAt && partReachedBay(part, cfg);
}

/**
 * Si ya toca pedir el mensajero.
 *
 * `bayReady` es que el patinador marcó «Entregado en bahía»: solo cuenta en una
 * plaza con patinador y sin logística, donde nadie más confirma que todo llegó.
 * Sin partes activas (todas canceladas) nunca: no hay nada que despachar.
 */
export function readyForCourier(
  cfg: ConsolidationConfig,
  parts: ConsolidationPart[],
  bayReady: boolean
): boolean {
  const activas = activeParts(parts);
  if (activas.length === 0) return false;

  if (cfg.logisticsRequired) return activas.every((p) => partReachedBay(p, cfg) && Boolean(p.bayReceivedAt));
  if (cfg.runnerRequired) return bayReady && activas.every((p) => partReachedBay(p, cfg));
  return activas.every((p) => p.status === 'at_collection');
}

export type RunnerCommissionType = 'percent' | 'fixed';

/**
 * La comisión del patinador por un pedido, en pesos y sin centavos.
 *
 * Porcentaje sobre los productos que sí viajan (una parte cancelada no se
 * recogió), o un valor fijo por pedido. Es informativa: no se cobra ni se
 * dispersa. `null` si la plaza no la configuró.
 */
export function runnerCommission(
  type: RunnerCommissionType | null | undefined,
  value: number | null | undefined,
  productsSubtotal: number
): number | null {
  if (!type || value == null) return null;
  if (type === 'fixed') return Math.round(value);
  return Math.round((Math.max(productsSubtotal, 0) * value) / 100);
}

/** Lo que cabe en la indicación del paquete de Pibox. */
const MAX_INDICACIONES = 1000;

/**
 * La indicación del paquete para el domiciliario: de qué tiendas es y cómo va
 * empacada cada parte. «Pedido de 2 tiendas · Fruver Doña Ana: 2 bolsas, fríos
 * en la azul · Carnes El Toro: todo en una bolsa blanca».
 */
export function packingNotesForCourier(parts: { storeName: string; packingNotes: string | null }[]): string {
  const notas = parts
    .map((p) => {
      const nota = (p.packingNotes ?? '').replace(/\s+/g, ' ').trim();
      return nota ? `${p.storeName}: ${nota}` : p.storeName;
    })
    .join(' · ');
  const texto = `Pedido de ${parts.length} ${parts.length === 1 ? 'tienda' : 'tiendas'} · ${notas}`;
  return texto.length > MAX_INDICACIONES ? `${texto.slice(0, MAX_INDICACIONES - 1)}…` : texto;
}
