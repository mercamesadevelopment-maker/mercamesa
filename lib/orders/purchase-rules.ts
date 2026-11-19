import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_STORES_PER_ORDER } from '@/lib/offers/offer-limit';
import { loadOrderMinPrice } from '@/lib/pricing/settings';
import { carrierOf, receiverOf } from './consolidation';
import { normalizeText } from '@/lib/utils/text';

/**
 * Las reglas para armar un pedido, dichas para el chat de Meteor
 * (`reglas_de_compra`). Las mismas que aplica el servidor al crear el pedido
 * (`buildOrderDraft`): esto solo las cuenta, no las decide.
 */

export interface MarketplaceRow {
  name: string;
  slug: string;
  runner_enabled: boolean;
  logistics_enabled: boolean;
}

export interface MarketplaceRules {
  name: string;
  /** Si en la plaza un pedido puede juntar varias tiendas. Hoy todas pueden. */
  multiStore: boolean;
  /** Quién lleva cada parte a la bahía y quién la recibe, para contarlo. */
  howItLeaves: string;
}

/** Cómo sale un pedido de varias tiendas en esa plaza. Sin base. */
export function marketplaceRules(m: MarketplaceRow): MarketplaceRules {
  const cfg = { runnerRequired: m.runner_enabled, logisticsRequired: m.logistics_enabled };
  const lleva =
    carrierOf(cfg) === 'runner'
      ? 'un patinador de la plaza recoge cada parte en su tienda y la lleva'
      : 'cada tienda lleva su parte';
  const recibe =
    receiverOf(cfg) === 'logistics'
      ? 'a la bahía de la plaza, donde la recibe logística; cuando están todas, sale un solo domicilio'
      : 'a la bahía de la plaza, de donde sale un solo domicilio con todo';
  return { name: m.name, multiStore: true, howItLeaves: `En un pedido de varias tiendas, ${lleva} ${recibe}.` };
}

export interface PurchaseRules {
  minimumOrder: number | null;
  maxStoresPerOrder: number;
  sameMarketplaceOnly: string;
  offers: string;
  marketplaces: MarketplaceRules[];
}

export function purchaseRules(minimumOrder: number | null, marketplaces: MarketplaceRow[]): PurchaseRules {
  return {
    minimumOrder,
    maxStoresPerOrder: MAX_STORES_PER_ORDER,
    sameMarketplaceOnly:
      'Un pedido sale en un solo domicilio: solo junta tiendas de la misma plaza que despachan desde ella. Una tienda con dirección propia va en un pedido aparte.',
    offers:
      'Algunas ofertas tienen un máximo por pedido (`maximo_por_pedido` en buscar_productos y detalle_producto). Más allá de ese máximo, el producto no entra al pedido.',
    marketplaces: marketplaces.map(marketplaceRules),
  };
}

/** Las reglas vigentes, de todas las plazas activas o de la que se nombre. */
export async function loadPurchaseRules(
  service: SupabaseClient<any>,
  plaza?: string | null
): Promise<PurchaseRules> {
  const [minimo, { data, error }] = await Promise.all([
    loadOrderMinPrice(service),
    service.from('marketplaces').select('name, slug, runner_enabled, logistics_enabled').eq('is_active', true).order('name'),
  ]);
  if (error) throw new Error(`No se pudieron leer las plazas: ${error.message}`);

  const buscada = plaza ? normalizeText(plaza) : '';
  const plazas = ((data ?? []) as MarketplaceRow[]).filter(
    (m) => !buscada || normalizeText(m.name).includes(buscada) || m.slug === buscada
  );
  return purchaseRules(minimo, plazas);
}
