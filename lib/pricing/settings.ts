import type { SupabaseClient } from '@supabase/supabase-js';
import type { PricingSettings } from './compute-order-pricing';

/**
 * Tarifas vigentes más los códigos de Siigo con los que se facturan el domicilio
 * y la comisión de plataforma.
 */
export interface PricingConfig extends PricingSettings {
  id: string;
  siigoDeliveryProductCode: string;
  siigoPlatformProductCode: string;
}

/**
 * Error de configuración: no hay tarifas cargadas. Se distingue de un fallo de
 * base para que las rutas puedan responder algo entendible en vez de un error
 * crudo de PostgREST.
 */
export class PricingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingConfigError';
  }
}

/**
 * Lee la tarifa vigente: la fila más reciente de `pricing_settings_history`.
 * Mismo patrón que el precio mínimo de orden en app/api/orders/route.ts.
 */
export async function loadPricingSettings(
  supabase: SupabaseClient<any>
): Promise<PricingConfig> {
  const { data, error } = await supabase
    .from('pricing_settings_history')
    .select(
      `id, service_commission_rate, message_unit_price, messages_per_order,
       platform_commission_rate, siigo_delivery_product_code, siigo_platform_product_code`
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new PricingConfigError(`No se pudieron leer las tarifas: ${error.message}`);
  }

  if (!data) {
    throw new PricingConfigError(
      'No hay tarifas configuradas. Regístralas en Parametrización → Tarifas y Comisiones antes de poder recibir pedidos.'
    );
  }

  return {
    id: data.id,
    serviceCommissionRate: Number(data.service_commission_rate),
    messageUnitPrice: Number(data.message_unit_price),
    messagesPerOrder: Number(data.messages_per_order),
    platformCommissionRate: Number(data.platform_commission_rate),
    siigoDeliveryProductCode: data.siigo_delivery_product_code,
    siigoPlatformProductCode: data.siigo_platform_product_code,
  };
}
