/**
 * Parámetros de facturación de Siigo.
 *
 * Todos son ids de la cuenta del cliente, así que van por variable de entorno:
 * cambian entre la cuenta de pruebas y la real, y no deben quedar incrustados.
 * Los valores por defecto son los consultados en la cuenta de producción, para
 * que la integración funcione sin configurar nada y siga siendo ajustable.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `document.id` de la factura de venta. GET /v1/document-types?type=FV */
export const SIIGO_FV_DOCUMENT_ID = envInt('SIIGO_FV_DOCUMENT_ID', 26727);

/** `seller` — obligatorio en la factura. GET /v1/users */
export const SIIGO_SELLER_ID = envInt('SIIGO_SELLER_ID', 823);

/**
 * Tipos de pago (GET /v1/payment-types?document_type=FV).
 *
 * Ojo: la cuenta NO tiene un tipo para PSE. Efectivo, Tarjeta Débito y Tarjeta
 * Crédito existen; PSE es el medio más usado en Mercamesa y no tiene
 * equivalente, así que cae en el genérico hasta que el contador del cliente
 * indique cuál corresponde. Es una decisión contable, no técnica.
 */
export const SIIGO_PAYMENT_TYPE_CASH = envInt('SIIGO_PAYMENT_TYPE_CASH', 6533);
export const SIIGO_PAYMENT_TYPE_CARD = envInt('SIIGO_PAYMENT_TYPE_CARD', 6535);
export const SIIGO_PAYMENT_TYPE_DEFAULT = envInt('SIIGO_PAYMENT_TYPE_DEFAULT', 6542);

/**
 * Enviar la factura a la DIAN.
 *
 * Arranca APAGADO a propósito. El único tipo FV de la cuenta es electrónico, así
 * que con esto en `true` cada factura se emite de verdad y corregir un error
 * obliga a una nota crédito. Se enciende cuando el flujo esté validado.
 */
export const SIIGO_STAMP_SEND = process.env.SIIGO_STAMP_SEND === 'true';

/** Enviar la factura por correo al cliente desde Siigo. */
export const SIIGO_MAIL_SEND = process.env.SIIGO_MAIL_SEND === 'true';

/**
 * Códigos de los productos de Siigo con los que se facturan el domicilio y la
 * comisión de plataforma.
 *
 * Son solo el respaldo: lo normal es que salgan de `pricing_settings_history`,
 * para que el administrador los cambie sin un despliegue. Si no hay ninguno de
 * los dos, el mapper lo dice explícitamente en vez de omitir el cobro y emitir
 * una factura descuadrada.
 */
export const SIIGO_DELIVERY_PRODUCT_CODE = process.env.SIIGO_DELIVERY_PRODUCT_CODE || '';
export const SIIGO_PLATFORM_PRODUCT_CODE = process.env.SIIGO_PLATFORM_PRODUCT_CODE || '';

/**
 * Ciudad por defecto del tercero (códigos DANE que exige POST /v1/customers).
 * `delivery_addresses` solo guarda texto libre, así que no hay de dónde
 * derivarlos. Medellín, que es donde están todas las plazas.
 */
export const SIIGO_DEFAULT_COUNTRY_CODE = process.env.SIIGO_DEFAULT_COUNTRY_CODE || 'CO';
export const SIIGO_DEFAULT_STATE_CODE = process.env.SIIGO_DEFAULT_STATE_CODE || '05';
export const SIIGO_DEFAULT_CITY_CODE = process.env.SIIGO_DEFAULT_CITY_CODE || '05001';

/** Tipo de identificación DIAN cuando el perfil no lo tiene resuelto. */
export const SIIGO_DEFAULT_ID_TYPE = process.env.SIIGO_DEFAULT_ID_TYPE || '13';

/**
 * Centro de costo cuando la plaza no lo tiene mapeado.
 *
 * El tipo de documento de FV tiene `cost_center: true`, así que Siigo lo exige.
 * Lo normal es que salga de `marketplaces.siigo_cost_center_id`; este es el
 * respaldo para no bloquear la facturación por un dato faltante.
 */
export const SIIGO_DEFAULT_COST_CENTER_ID = envInt('SIIGO_DEFAULT_COST_CENTER_ID', 10119);

/** Intentos antes de dejar de reintentar una factura. */
export const SIIGO_MAX_INVOICE_ATTEMPTS = envInt('SIIGO_MAX_INVOICE_ATTEMPTS', 5);

/**
 * Traduce el medio de pago de ZonaPagos al tipo de pago de Siigo.
 * `payments.payment_method` viene de `mapZonaPagosMethod` en las Edge Functions.
 */
export function toSiigoPaymentTypeId(paymentMethod: string | null): number {
  switch (paymentMethod) {
    case 'card':
      return SIIGO_PAYMENT_TYPE_CARD;
    case 'cash':
      return SIIGO_PAYMENT_TYPE_CASH;
    // 'pse' y 'unknown' caen acá: la cuenta no tiene un tipo de pago para PSE.
    default:
      return SIIGO_PAYMENT_TYPE_DEFAULT;
  }
}
