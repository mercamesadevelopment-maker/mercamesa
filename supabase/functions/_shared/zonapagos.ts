/**
 * Lo que comparten las funciones de ZonaPagos: consultar un intento de pago en
 * la pasarela y decidir, con todos los intentos de un pedido, cómo queda el
 * pedido.
 *
 * `zonapagos-sync` (el comprador vuelve de la pasarela), `zonapagos-sonda` (el
 * cron) y `zonapagos-inicio` (antes de abrir otro intento) confirman el mismo
 * pago por caminos distintos y tienen que dejar el mismo dato en la tabla.
 */

export type EstadoDePago = 'pending' | 'processing' | 'approved' | 'rejected';

/** Estados de un intento que todavía puede terminar aprobado. */
export const ESTADOS_ABIERTOS: EstadoDePago[] = ['pending', 'processing'];

// 1000 rechazada, 1001 error entre ACH y el banco, 4000 rechazada CR, 4003 error CR.
const CODIGOS_DE_RECHAZO = [1000, 1001, 4000, 4003];

/**
 * Traduce el código de medio de pago que devuelve ZonaPagos en la posición 22 de
 * `str_res_pago`.
 *
 * `1001` es el que manda producción de verdad. Se verificó contra los dos únicos
 * pagos que llegaron a una entidad financiera: uno por Nequi (entidad 1507) y
 * uno por BBVA (entidad 1013), ambos con código 1001. El `2701` que aparece en
 * la documentación nunca se ha visto, así que se conserva por compatibilidad
 * pero no es el que llega.
 *
 * Sin esta traducción los 13 pagos históricos quedaron todos en 'unknown', que
 * en Siigo cae en "Clientes Nacionales" (una cuenta por cobrar) en vez del medio
 * real.
 */
export function mapZonaPagosMethod(code?: string | null) {
  switch (code) {
    case '1001':
    case '2701':
      return 'pse';
    case '1000':
      return 'card';
    case '3000':
      return 'cash';
    default:
      return 'unknown';
  }
}

/**
 * `entityName` es la posición 24: el banco o la billetera con la que se pagó
 * (NEQUI, BANCO BBVA COLOMBIA S.A....). Se muestra junto al medio porque es lo
 * que el comprador reconoce de su extracto.
 */
export function getPaymentMethodLabel(method: string, entityName?: string | null) {
  switch (method) {
    case 'pse':
      return entityName ? `PSE - ${entityName}` : 'PSE';
    case 'card':
      return 'Tarjeta de Crédito/Débito';
    case 'cash':
      return 'Efectivo';
    default:
      return entityName || 'Otro';
  }
}

function estadoDelCodigo(codigoRaw?: string): EstadoDePago {
  const codigo = parseInt(codigoRaw || '-1');
  if (Number.isNaN(codigo) || codigo === -1) return 'pending';
  if (codigo === 1) return 'approved';
  if (CODIGOS_DE_RECHAZO.includes(codigo)) return 'rejected';
  return 'processing';
}

/**
 * Lee la respuesta de `VerificacionPago`.
 *
 * `str_res_pago` trae un registro por cada transacción hecha con el mismo
 * `str_id_pago`, separados por `;`, y cada registro va separado por `|`.
 * IMPORTANTE: no filtrar los campos vacíos de un registro, porque corre las
 * posiciones. Posiciones verificadas contra respuestas reales de producción:
 *  4: código de estado de la transacción (1 = aprobada)
 * 21: número de pago de la pasarela
 * 22: código del medio de pago (1001 = PSE)
 * 23: código de la entidad financiera (1507 = Nequi, 1013 = BBVA)
 * 24: nombre de la entidad (NEQUI, BANCO BBVA COLOMBIA S.A.)
 *
 * Si hay varios registros, uno aprobado gana; después, uno que siga en curso.
 */
export function leerVerificacion(result: any) {
  const registros: string[][] = String(result?.str_res_pago ?? '')
    .split(';')
    .map((registro) => registro.split('|').map((p) => p.trim()))
    .filter((campos) => campos.some(Boolean));

  if (registros.length === 0) {
    return { status: 'pending' as EstadoDePago, campos: null };
  }

  const conEstado = registros.map((campos) => ({ campos, status: estadoDelCodigo(campos[4]) }));
  return (
    conEstado.find((r) => r.status === 'approved') ??
    conEstado.find((r) => r.status === 'processing') ??
    conEstado[conEstado.length - 1]
  );
}

/**
 * Consulta un intento en ZonaPagos y guarda lo que responda en `payments`.
 * Devuelve el estado del intento, o `null` si la pasarela no contestó (el
 * intento queda como estaba).
 */
export async function verificarIntento(
  supabase: any,
  payment: { id: string; str_id_pago: string }
): Promise<EstadoDePago | null> {
  const response = await fetch(
    'https://www.zonapagos.com/Apis_CicloPago/api/VerificacionPago',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        int_id_comercio: parseInt(Deno.env.get('ZONAPAGOS_ID_COMERCIO') || '0'),
        str_usr_comercio: Deno.env.get('ZONAPAGOS_USUARIO'),
        str_pwd_Comercio: Deno.env.get('ZONAPAGOS_CLAVE'),
        str_id_pago: payment.str_id_pago,
        int_no_pago: -1,
      }),
    }
  );

  if (!response.ok) return null;

  const result = await response.json();
  const { status, campos } = leerVerificacion(result);

  const cambios: Record<string, unknown> = {
    status,
    callback_response: result,
    updated_at: new Date().toISOString(),
  };
  if (campos) {
    const paymentMethod = mapZonaPagosMethod(campos[22]);
    cambios.payment_method = paymentMethod;
    cambios.payment_method_label = getPaymentMethodLabel(paymentMethod, campos[24]);
    cambios.provider_payment_id = campos[21] || null;
  }

  const { error } = await supabase.from('payments').update(cambios).eq('id', payment.id);
  if (error) throw new Error(`Update payment error: ${error.message}`);

  return status;
}

/** Consulta en ZonaPagos todos los intentos del pedido que siguen sin resolver. */
export async function verificarIntentosAbiertos(supabase: any, orderId: string) {
  const { data: abiertos, error } = await supabase
    .from('payments')
    .select('id, str_id_pago')
    .eq('order_id', orderId)
    .in('status', ESTADOS_ABIERTOS);

  if (error) throw new Error(`Payments query error: ${error.message}`);

  for (const intento of abiertos ?? []) {
    await verificarIntento(supabase, intento);
  }
}

/**
 * Deja el pedido en el estado que resulta de TODOS sus intentos de pago y lo
 * devuelve (`null` si el pedido no tiene intentos).
 *
 * Un pedido puede tener varios intentos (el botón «Pagar» de «Mis órdenes» abre
 * uno nuevo cada vez). Un aprobado siempre gana, y el pedido solo queda
 * rechazado cuando ya no queda ningún intento por resolver. Mirar solo el
 * último intento marcó como rechazado un pedido que el comprador ya había
 * pagado en el intento anterior, que el banco todavía no había confirmado.
 */
export async function resolverPedido(supabase: any, orderId: string): Promise<EstadoDePago | null> {
  const { data: intentos, error } = await supabase
    .from('payments')
    .select('status')
    .eq('order_id', orderId);

  if (error) throw new Error(`Payments query error: ${error.message}`);

  const estados = (intentos ?? []).map((i: { status: string }) => i.status);
  const estado = (['approved', 'processing', 'pending', 'rejected'] as EstadoDePago[])
    .find((e) => estados.includes(e));
  if (!estado) return null;

  const orderUpdate: Record<string, unknown> = {
    payment_status: estado,
    updated_at: new Date().toISOString(),
  };
  if (estado === 'approved') {
    orderUpdate.status = 'confirmed';
  }

  // Un pedido ya pagado no vuelve atrás.
  let orderQuery = supabase.from('orders').update(orderUpdate).eq('id', orderId);
  if (estado !== 'approved') {
    orderQuery = orderQuery.neq('payment_status', 'approved');
  }
  const { error: updateOrderError } = await orderQuery;
  if (updateOrderError) throw new Error(`Update order error: ${updateOrderError.message}`);

  if (estado === 'approved') {
    await supabase.from('cart_items').delete().eq('order_id', orderId);
    return estado;
  }

  const { data: order } = await supabase
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .maybeSingle();
  return order?.payment_status === 'approved' ? 'approved' : estado;
}
