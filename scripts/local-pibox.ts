/**
 * scripts/local-pibox.ts
 *
 * Simula, en la base LOCAL, lo que Pibox le avisaría a MercaMesa por webhook
 * mientras un mensajero lleva un pedido. Sirve para ver el seguimiento del
 * domicilio en las tres pantallas (comprador, tienda y admin) sin despachar a
 * nadie de verdad.
 *
 * Los eventos tienen exactamente la forma de la documentación de Pibox
 * (docs/picap.MD, «Webhooks»): event_cd 0 para el pedido, con `driver` y
 * `vehicle`, y event_cd 1 para el paquete. Se mandan al webhook local con el
 * mismo encabezado secreto que usaría Pibox, así que se prueba el receptor real.
 *
 * Uso (el pedido tiene que estar en «Listo Recogida», con su reserva simulada):
 *   pnpm local:pibox MM-2026-001090-1 asignado
 *
 * Pasos: buscando | asignado | recogido | entregado | sin-conductor |
 *        relanzado | atrasado
 *
 * Solo corre contra la base local y el servidor de desarrollo.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const HOSTS_LOCALES = ['127.0.0.1', 'localhost'];
const WEBHOOK_URL = process.env.LOCAL_APP_URL
  ? `${process.env.LOCAL_APP_URL.replace(/\/$/, '')}/api/pibox/webhook`
  : 'http://localhost:4005/api/pibox/webhook';

/** Datos de ejemplo, con la forma de la documentación. */
const CONDUCTOR = { id: '613a3ea7a585b2001e1eb92c', name: 'David (simulado)', phone: '3013016295' };
const OTRO_CONDUCTOR = { id: '613a3ea7a585b2001e1eb93d', name: 'Marta (simulada)', phone: '3015550101' };
const VEHICULO = { plates: 'POI123' };

const PASOS = ['buscando', 'asignado', 'recogido', 'entregado', 'sin-conductor', 'relanzado', 'atrasado'] as const;
type Paso = (typeof PASOS)[number];

async function main() {
  const [code, paso] = process.argv.slice(2) as [string, Paso];
  if (!code || !PASOS.includes(paso)) {
    console.error(`Uso: pnpm local:pibox <código del pedido de tienda> <${PASOS.join(' | ')}>`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PIBOX_WEBHOOK_SECRET;
  if (!url || !key) {
    console.error('No se encontró .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  if (!HOSTS_LOCALES.includes(new URL(url).hostname)) {
    console.error(`Este script solo corre contra la base local, y la URL configurada es ${new URL(url).host}.`);
    process.exit(1);
  }
  if (!secret) {
    console.error('Falta PIBOX_WEBHOOK_SECRET en .env.local (cualquier texto: es solo para el webhook local).');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Acepta el código de la parte de tienda (MM-…-1) o el del pedido. En un
  // pedido de varias tiendas la reserva es del pedido entero: cualquiera de los
  // dos códigos sirve.
  let { data: storeOrders } = await supabase
    .from('store_orders')
    .select('id, code, status, order_id')
    .eq('code', code);

  if (!storeOrders?.length) {
    const { data: order } = await supabase.from('orders').select('id').eq('code', code).maybeSingle();
    if (order) {
      ({ data: storeOrders } = await supabase
        .from('store_orders')
        .select('id, code, status, order_id')
        .eq('order_id', order.id));
    }
  }

  if (!storeOrders?.length) {
    console.error(`No encontré un pedido con el código ${code}.`);
    process.exit(1);
  }
  const orderId = storeOrders[0].order_id;

  const { data: booking } = await supabase
    .from('pibox_bookings')
    .select('booking_id, package_id, is_active, tracking_link')
    .or(`order_id.eq.${orderId},store_order_id.in.(${storeOrders.map((s) => s.id).join(',')})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!booking) {
    console.error(`El pedido ${code} no tiene domiciliario solicitado todavía.`);
    process.exit(1);
  }
  if (!booking.booking_id.startsWith('SIMULADO-')) {
    console.error('La reserva de este pedido no es simulada: este script no toca reservas reales.');
    process.exit(1);
  }

  // Lo que en producción traería `GET /bookings/{id}` (el cron o el detalle):
  // id del paquete, enlace de seguimiento y códigos. La reserva simulada nace
  // sin ellos, así que se completan una vez para poder verlos en pantalla.
  const packageId = booking.package_id ?? `${booking.booking_id}-1`;
  if (!booking.tracking_link) {
    await supabase
      .from('pibox_bookings')
      .update({
        package_id: packageId,
        tracking_link: `https://pibox.app/tracking/${packageId}`,
        pickup_validation_code: '116237',
        validation_code: '4821',
        estimated_cost: 9200,
      })
      .eq('booking_id', booking.booking_id);
  }

  const ahora = new Date().toISOString();
  // Un instante después de `ahora`: para que los avisos de un mismo paso no
  // compartan la fecha y el filtro de avisos atrasados no descarte ninguno.
  const luego = (ms: number) => new Date(Date.now() + ms).toISOString();
  const pedido = (status_cd: number, extra: Record<string, unknown> = {}, created_at = ahora) => ({
    booking_id: booking.booking_id,
    status_cd,
    event_cd: 0,
    created_at,
    relaunched_to_id: null,
    ...extra,
  });
  const paquete = (status_cd: number) => ({ package_id: packageId, status_cd, event_cd: 1, created_at: ahora });
  const conConductor = { driver: CONDUCTOR, vehicle: VEHICULO };

  const eventos: Record<Paso, object[]> = {
    buscando: [pedido(0)],
    asignado: [pedido(1, conConductor)],
    recogido: [pedido(5, conConductor), paquete(1), pedido(6, conConductor)],
    entregado: [pedido(7, conConductor), paquete(2), pedido(4, conConductor)],
    'sin-conductor': [pedido(101)],
    // Como lo hace Picap de verdad (prueba real del 14 oct.): el conductor
    // cancela sobre la reserva original con un `relaunched_to_id`, y los avisos
    // siguientes llegan con ese id nuevo, que es interno de Picap. Para la app
    // debe seguir siendo la misma reserva, ahora con otro conductor.
    relanzado: (() => {
      const sucesor = `SIMULADO-${crypto.randomUUID()}`;
      return [
        pedido(100, { ...conConductor, relaunched_to_id: sucesor }, luego(0)),
        { ...pedido(0, {}, luego(10)), booking_id: sucesor },
        { ...pedido(1, { driver: OTRO_CONDUCTOR, vehicle: { plates: 'XYZ987' } }, luego(20)), booking_id: sucesor },
      ];
    })(),
    // Un «Paquete a bordo» de hace una hora, que llega tarde: no debe hacer retroceder nada.
    atrasado: [pedido(6, conConductor, new Date(Date.now() - 3_600_000).toISOString())],
  };

  for (const evento of eventos[paso]) {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-pibox-secret': secret },
      body: JSON.stringify(evento),
    });
    const body = await res.text();
    console.log(`→ ${JSON.stringify(evento)}\n  ${res.status} ${body}`);
    // Un instante entre eventos: así el orden de llegada es el de envío.
    await new Promise((r) => setTimeout(r, 300));
  }

  const { data: after } = await supabase
    .from('store_orders')
    .select('id, status')
    .in('id', storeOrders.map((s) => s.id));
  for (const so of storeOrders) {
    console.log(`Pedido ${so.code}: ${so.status} → ${after?.find((x) => x.id === so.id)?.status}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
