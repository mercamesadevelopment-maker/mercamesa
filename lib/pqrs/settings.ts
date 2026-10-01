import type { SupabaseClient } from '@supabase/supabase-js';
import type { PqrsSettings } from './types';

/**
 * Los plazos vigentes de las PQRS.
 *
 * Mismo patrón que `loadPayoutSettings`: la tabla es un histórico y la fila más
 * reciente es la que aplica. La migración sembró una, así que la ausencia es un
 * fallo de datos; se responde con los valores iniciales para no dejar a un
 * comprador sin poder reclamar por eso.
 */
const RESPALDO: Omit<PqrsSettings, 'id'> = { claimWindowHours: 24, storeResponseHours: 24 };

export async function loadPqrsSettings(service: SupabaseClient<any>): Promise<PqrsSettings | (Omit<PqrsSettings, 'id'> & { id: null })> {
  const { data, error } = await service
    .from('pqrs_settings_history')
    .select('id, claim_window_hours, store_response_hours')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudieron leer los plazos de PQRS: ${error.message}`);
  }

  if (!data) return { id: null, ...RESPALDO };

  return {
    id: data.id,
    claimWindowHours: data.claim_window_hours,
    storeResponseHours: data.store_response_hours,
  };
}
