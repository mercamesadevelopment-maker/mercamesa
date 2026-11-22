/**
 * La descripción del pago que se le manda a ZonaPagos (`str_descripcion_pago`).
 *
 * ZonaPagos rechaza el intento si pasa de 70 caracteres. El id del pedido ya
 * ocupa 36, así que el nombre de una tienda largo se recorta: el pedido se
 * identifica por su id, que además viaja en `str_opcional1`.
 */
export const ZONAPAGOS_MAX_DESCRIPCION = 70;

const ELIPSIS = '…';

export function paymentDescription(orderId: string, storeName?: string | null): string {
  const base = `Pedido ${orderId}`;
  const tienda = storeName?.trim();
  if (!tienda) return base.slice(0, ZONAPAGOS_MAX_DESCRIPCION);

  const completa = `${base} - ${tienda}`;
  if (completa.length <= ZONAPAGOS_MAX_DESCRIPCION) return completa;

  const espacio = ZONAPAGOS_MAX_DESCRIPCION - `${base} - `.length - ELIPSIS.length;
  if (espacio <= 0) return base.slice(0, ZONAPAGOS_MAX_DESCRIPCION);
  return `${base} - ${tienda.slice(0, espacio).trimEnd()}${ELIPSIS}`;
}
