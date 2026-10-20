import { NextResponse } from 'next/server';

/**
 * Antiguo «callback» de ZonaPagos. Ya no hace nada.
 *
 * Marcaba el pago como aprobado con lo que llegara en el cuerpo, sin firma ni
 * consulta a ZonaPagos, y con la sesión del que llamaba: cualquiera podía
 * aprobar un pedido sin pagarlo. Los pagos se confirman consultando a
 * ZonaPagos (`zonapagos-sonda`, `zonapagos-sync`) y por `zonapagos-token-notify`.
 *
 * Se deja respondiendo 200 por si la URL sigue configurada en el panel de
 * ZonaPagos, para que no la reintente ni la reporte como caída.
 */
export async function POST() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
