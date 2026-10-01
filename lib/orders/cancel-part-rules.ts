/**
 * Reglas de la cancelación de una parte que comparten el formulario y el
 * servidor. Va aparte de `cancel-store-part.ts` porque ese archivo usa el
 * cliente de servicio y no puede llegar al navegador.
 */

/** Largo mínimo del motivo: lo lee el comprador, así que tiene que decir algo. */
export const MIN_CANCEL_REASON = 10;
