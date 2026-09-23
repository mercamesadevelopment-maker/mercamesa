import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Los datos del ordenante, vigentes.
 *
 * Mismo patrón que `loadPricingSettings`: la tabla es un histórico y la fila más
 * reciente es la que aplica. Lo que cambia es que acá no hay semilla posible —el
 * NIT, la cuenta y la clave del emisor los da el banco— así que la ausencia de
 * configuración es un caso normal el primer día, no una falla.
 */

export interface PayoutSettings {
  id: string;
  ordererDocumentType: string;
  ordererDocumentNumber: string;
  ordererDv: string;
  ordererSuffix: string;
  ordererName: string;
  ordererAddress: string;
  ordererCity: string;
  bbvaOfficeCode: string;
  bbvaAccountNumber: string;
  emitterKey: string;
  paymentConcept: string;
  fileConsecutiveOffset: number;
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

export async function loadPayoutSettings(
  supabase: SupabaseClient<any>
): Promise<PayoutSettings> {
  const { data, error } = await supabase
    .from('payout_settings_history')
    .select(
      `id, orderer_document_type, orderer_document_number, orderer_dv, orderer_suffix,
       orderer_name, orderer_address, orderer_city, bbva_office_code, bbva_account_number,
       emitter_key, payment_concept, file_consecutive_offset, hold_days`
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudieron leer los parámetros de dispersión: ${error.message}`);
  }

  if (!data) {
    throw new PayoutConfigError(
      'Todavía no están cargados los datos del ordenante. Regístralos en ' +
        'Dispersiones → Parámetros: el NIT, la cuenta y la clave del emisor los da el banco.'
    );
  }

  return {
    id: data.id,
    ordererDocumentType: data.orderer_document_type,
    ordererDocumentNumber: data.orderer_document_number,
    ordererDv: data.orderer_dv,
    ordererSuffix: data.orderer_suffix,
    ordererName: data.orderer_name,
    ordererAddress: data.orderer_address,
    ordererCity: data.orderer_city,
    bbvaOfficeCode: data.bbva_office_code,
    bbvaAccountNumber: data.bbva_account_number,
    emitterKey: data.emitter_key,
    paymentConcept: data.payment_concept,
    fileConsecutiveOffset: data.file_consecutive_offset,
    holdDays: data.hold_days,
  };
}
