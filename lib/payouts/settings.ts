import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Los parámetros de dispersión vigentes.
 *
 * Mismo patrón que `loadPricingSettings`: la tabla es un histórico y la fila más
 * reciente es la que aplica.
 *
 * En el formato por líneas de BBVA el archivo no lleva datos del ordenante, así
 * que aquí solo queda el concepto de pago (el Concepto 1 de cada línea) y los
 * días de espera tras la entrega, que son regla de la plataforma. La migración
 * que cambió de formato sembró una fila, así que la ausencia es un fallo de
 * datos y no el caso normal del primer día.
 */

export interface PayoutSettings {
  id: string;
  paymentConcept: string;
  holdDays: number;
}

/**
 * Se distingue de un fallo de base para que la pantalla pueda decir qué hacer en
 * vez de "error inesperado".
 */
export class PayoutConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayoutConfigError';
  }
}

export function aParametros(data: { id: string; payment_concept: string; hold_days: number }): PayoutSettings {
  return {
    id: data.id,
    paymentConcept: data.payment_concept,
    holdDays: data.hold_days,
  };
}

export async function loadPayoutSettings(
  supabase: SupabaseClient<any>
): Promise<PayoutSettings> {
  const { data, error } = await supabase
    .from('payout_settings_history')
    .select('id, payment_concept, hold_days')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudieron leer los parámetros de dispersión: ${error.message}`);
  }

  if (!data) {
    throw new PayoutConfigError(
      'No hay parámetros de dispersión. Regístralos en Dispersiones → Parámetros.'
    );
  }

  return aParametros(data);
}
