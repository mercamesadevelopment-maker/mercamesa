import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildBookingPayload,
  estimateBooking,
  fromSubUnits,
  isPiboxEnabled,
  loadQuoteContext,
  PiboxDataError,
} from '@/lib/pibox';

/**
 * No hay un costo de domicilio confiable, así que el pedido no se puede
 * completar. Decisión del cliente: antes que cobrar un valor equivocado o crear
 * un pedido que después no se pueda despachar, se detiene la compra.
 */
export class DeliveryQuoteUnavailableError extends Error {
  /** Detalle técnico para los logs. Nunca se le muestra al comprador. */
  readonly cause: string;

  constructor(cause: string) {
    super(DELIVERY_QUOTE_UNAVAILABLE_MESSAGE);
    this.name = 'DeliveryQuoteUnavailableError';
    this.cause = cause;
  }
}

/**
 * Lo único que ve el comprador cuando falla la cotización.
 *
 * Vive acá —y no en el componente— para que el servidor y el carrito digan
 * exactamente lo mismo. Tres decisiones deliberadas: no nombra a Pibox (al
 * comprador no le dice nada y expone un proveedor), aclara que el carrito no se
 * pierde (es la duda inmediata), y ofrece una salida en vez de dejarlo sin
 * opciones.
 */
export const DELIVERY_QUOTE_UNAVAILABLE_MESSAGE =
  'En este momento no podemos calcular el costo del envío. Estamos presentando una falla con nuestro operador logístico. Vuelve a intentarlo en unos minutos; tu carrito se mantiene guardado. Si el problema continúa, escríbenos y te ayudamos a completar tu pedido.';

export interface DeliveryQuoteInput {
  storeId: string;
  deliveryAddressId: string;
  buyerId: string;
  /** Valor declarado del envío: el subtotal de productos de esa tienda. */
  subtotal: number;
}

/**
 * Cotiza el domicilio con Pibox antes de que exista el pedido.
 *
 * Cualquier motivo por el que no se obtenga un valor —integración apagada, caída
 * de Pibox, o datos incompletos— termina en `DeliveryQuoteUnavailableError`. Es
 * a propósito: desde el punto de vista del comprador los tres casos son el
 * mismo, y ninguno permite cobrar.
 */
export async function quoteDeliveryFee(
  supabase: SupabaseClient<any>,
  input: DeliveryQuoteInput
): Promise<number> {
  if (!isPiboxEnabled()) {
    throw new DeliveryQuoteUnavailableError('PIBOX_ENABLED está apagado');
  }

  try {
    const context = await loadQuoteContext(supabase, input);
    // Cotizar no contacta a nadie, así que no se exige teléfono del comprador:
    // ese requisito solo aplica al crear la reserva real.
    const payload = buildBookingPayload(context, { requireCustomerPhone: false });

    const eta = await estimateBooking(payload);
    const fare = fromSubUnits(eta.fare?.subunits);

    if (!Number.isFinite(fare) || fare <= 0) {
      throw new DeliveryQuoteUnavailableError(
        `Pibox devolvió una tarifa inválida: ${JSON.stringify(eta.fare)}`
      );
    }

    return fare;
  } catch (error: unknown) {
    if (error instanceof DeliveryQuoteUnavailableError) throw error;

    // `PiboxDataError` es un dato del negocio incompleto (dirección sin
    // coordenadas en un municipio que Pibox no geocodifica, plaza sin
    // dirección). No se puede cobrar a ciegas: sin coordenadas ni city_code
    // válido, el domicilio saldría a un punto equivocado.
    const cause =
      error instanceof PiboxDataError
        ? `Datos incompletos: ${error.message}`
        : error instanceof Error
        ? error.message
        : String(error);

    console.error('No se pudo cotizar el domicilio con Pibox:', cause);
    throw new DeliveryQuoteUnavailableError(cause);
  }
}
