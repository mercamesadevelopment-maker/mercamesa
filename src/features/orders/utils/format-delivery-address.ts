interface AddressParts {
  address_line?: string | null;
  neighborhood?: string | null;
  municipality?: string | null;
  department?: string | null;
}

/**
 * Arma el texto de la dirección de entrega de una orden.
 *
 * Prefiere la copia congelada (`orders.delivery_address_snapshot`), que refleja
 * a dónde se envió realmente el pedido; si no existe (órdenes anteriores a esa
 * columna) cae al JOIN vigente con `delivery_addresses`.
 *
 * @param fallbackLabel qué mostrar cuando no hay ninguna de las dos. Para las
 *   ventas físicas del historial del vendedor se pasa un texto propio.
 */
export function formatDeliveryAddress(
  snapshot: unknown,
  joined: AddressParts | null | undefined,
  fallbackLabel = 'Sin dirección registrada'
): string {
  const parts = (snapshot as AddressParts | null) ?? joined;
  if (!parts) return fallbackLabel;

  const text = [parts.address_line, parts.neighborhood, parts.municipality, parts.department]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ');

  return text || fallbackLabel;
}
