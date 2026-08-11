/**
 * Tokenización de tarjetas (guardar tarjeta y pagar con tarjeta guardada).
 *
 * Desactivada a pedido del cliente. El código se conserva completo y funcional:
 * volver a poner esto en `true` reactiva las dos cosas sin ningún otro cambio.
 *
 * Gatea:
 *  - el checkbox "Guardar esta tarjeta para futuros pagos" (CartPanel)
 *  - la opción "Pagar con tarjeta guardada" y su selector (CartPanel)
 *  - la carga de `buyer_payment_methods` (useCheckout)
 *  - el envío de `guardarTarjeta`, que es lo que hace que el edge function
 *    zonapagos-inicio agregue el `int_codigo: 200` con el que Zonapagos
 *    tokeniza la tarjeta
 *
 * Las tarjetas ya guardadas siguen visibles y borrables desde el perfil.
 */
export const CARD_TOKENIZATION_ENABLED = false;
