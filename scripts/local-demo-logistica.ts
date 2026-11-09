/**
 * scripts/local-demo-logistica.ts
 *
 * Deja en la base LOCAL pedidos de varias tiendas de Placita de Flórez en cada
 * punto del recorrido, para mostrar el trabajo de logística en la bahía sin
 * tener que armarlos uno por uno.
 *
 * Uso:
 *   pnpm local:demo-logistica
 *
 * Cada vez crea pedidos nuevos (no toca los anteriores). Usa las cuentas de
 * `supabase/seed/local.sql` y las dos tiendas de prueba de Flórez, que en local
 * despachan desde la bahía.
 *
 * No escribe nada a mano: cada paso pasa por la misma función de `lib/` que usa
 * la app (crear el pedido, avanzar una tienda, recoger, «Entregado en bahía»,
 * recibir con foto), así que cumple las mismas reglas. Solo el pago es simulado,
 * como en `pnpm local:pay`.
 *
 * Se niega a correr si la base no es la de esta máquina, o si Pibox o el correo
 * no están en modo simulado: no sale ningún mensajero ni ningún correo.
 */
import { exitWithError, localEnv } from './local/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { payLocalOrder } from './local/pay-order';
import { createOrder } from '../lib/orders/create-order';
import { changeStoreOrderStatus } from '../lib/orders/change-store-order-status';
import { loadStaffActor, type StaffActor } from '../lib/marketplace-staff/actor';
import { collectPart, markAtBay } from '../lib/runner/orders';
import { receivePart } from '../lib/logistics/orders';
import { LOGISTICS_BUCKET } from '../lib/logistics/bucket';
import { createPhotoUploadTicket } from '../lib/storage/private-photos';

const PLAZA = 'placita-florez';
const TIENDAS = {
  felipe: 'd7bcc099-a520-4401-a064-3fbdf7448c61', // Tienda de Prueba Felipe
  florez: '3316d71c-040f-4207-80f6-33398c9fd6e0', // Tienda de prueba Placita de Flórez
};
const CUENTAS = {
  comprador: { email: 'comprador@mercamesa.local', clave: 'comprador-local' },
  patinador: 'patinador@mercamesa.local',
  logistica: 'logistica@mercamesa.local',
};

/** Hasta dónde llega cada pedido. Cada uno muestra un momento distinto en la bahía. */
type Etapa = 'preparando' | 'recogiendo' | 'en_bahia' | 'una_recibida' | 'listo_para_despachar';

const ETAPAS: { etapa: Etapa; texto: string }[] = [
  { etapa: 'preparando', texto: 'Las tiendas lo están preparando: logística todavía no tiene nada que hacer' },
  { etapa: 'recogiendo', texto: 'El patinador recogió una parte y va por la otra' },
  { etapa: 'en_bahia', texto: 'El patinador lo dejó en la bahía: logística recibe las dos partes' },
  { etapa: 'una_recibida', texto: 'Logística recibió una parte y falta la otra' },
  { etapa: 'listo_para_despachar', texto: 'Logística recibió todo y se pidió el mensajero (simulado): falta despacharlo' },
];

/** Un PNG de 1×1: la foto de prueba de la recepción. */
const FOTO_DE_PRUEBA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

interface Contexto {
  service: SupabaseClient<any>;
  comprador: { cliente: SupabaseClient<any>; id: string; direccionId: string };
  tenderos: Map<string, string>;
  patinador: StaffActor;
  logistica: StaffActor;
  productos: { id: string; storeId: string; nombre: string; unidad: string; precio: number }[];
}

function exigirModoSimulado() {
  if (process.env.PIBOX_DRY_RUN !== 'true') {
    throw new Error('PIBOX_DRY_RUN no está en true: se pedirían mensajeros de verdad. Revisa .env.local.');
  }
  if (process.env.EMAIL_DRY_RUN !== 'true') {
    throw new Error('EMAIL_DRY_RUN no está en true: saldrían correos de verdad. Revisa .env.local.');
  }
}

async function idDe(service: SupabaseClient<any>, email: string): Promise<string> {
  const { data } = await service.from('profiles').select('id').eq('email', email).maybeSingle();
  if (!data) throw new Error(`No existe ${email}. Corre pnpm db:reset para cargar supabase/seed/local.sql.`);
  return data.id;
}

async function prepararContexto(): Promise<Contexto> {
  const { url, anonKey, serviceKey } = localEnv();
  exigirModoSimulado();

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  // El comprador entra con su contraseña: el pedido se crea con su sesión, como
  // desde la canasta, y pasa por las mismas políticas.
  const cliente = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: sesion, error: loginError } = await cliente.auth.signInWithPassword({
    email: CUENTAS.comprador.email,
    password: CUENTAS.comprador.clave,
  });
  if (loginError || !sesion.user) {
    throw new Error(`No pudo entrar ${CUENTAS.comprador.email}: ${loginError?.message}. ¿Corriste pnpm db:reset?`);
  }

  const { data: direccion } = await service
    .from('delivery_addresses')
    .select('id')
    .eq('buyer_id', sesion.user.id)
    .limit(1)
    .maybeSingle();
  if (!direccion) throw new Error(`${CUENTAS.comprador.email} no tiene dirección de entrega.`);

  const { data: tiendas } = await service
    .from('stores')
    .select('id, name, pickup_group, marketplaces!inner ( slug, runner_enabled, logistics_enabled )')
    .in('id', Object.values(TIENDAS));
  if (!tiendas || tiendas.length !== 2) throw new Error('No están las dos tiendas de prueba de Flórez en la base local.');
  if (tiendas.some((t: any) => t.marketplaces.slug !== PLAZA)) throw new Error('Las tiendas de prueba ya no son de Flórez.');
  if (tiendas[0].pickup_group !== tiendas[1].pickup_group) {
    throw new Error('Las tiendas de prueba no comparten bahía. Corre pnpm db:reset para cargar supabase/seed/local.sql.');
  }
  const plaza = (tiendas[0] as any).marketplaces;
  if (!plaza.runner_enabled || !plaza.logistics_enabled) {
    throw new Error('Flórez no tiene patinador y logística encendidos. Corre pnpm db:reset.');
  }

  // Quien avanza cada parte en el historial: un miembro de la tienda.
  const { data: miembros } = await service.from('store_members').select('store_id, user_id').in('store_id', Object.values(TIENDAS));
  const tenderos = new Map<string, string>();
  for (const m of miembros ?? []) if (!tenderos.has(m.store_id)) tenderos.set(m.store_id, m.user_id);

  // De cada tienda, el producto activo con más inventario.
  const productos: Contexto['productos'] = [];
  for (const storeId of Object.values(TIENDAS)) {
    const { data: p } = await service
      .from('store_products')
      .select('id, store_id, price_per_unit, stock, catalog_products ( name ), measurement_units ( abbreviation )')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('stock', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!p || Number(p.stock) < ETAPAS.length) throw new Error(`La tienda ${storeId} no tiene un producto con inventario.`);
    productos.push({
      id: p.id,
      storeId,
      nombre: (p as any).catalog_products?.name ?? 'Producto',
      unidad: (p as any).measurement_units?.abbreviation ?? 'und',
      precio: Number(p.price_per_unit),
    });
  }

  const [patinador, logistica] = await Promise.all([
    idDe(service, CUENTAS.patinador).then((id) => loadStaffActor(service, id, ['runner'])),
    idDe(service, CUENTAS.logistica).then((id) => loadStaffActor(service, id, ['logistics'])),
  ]);

  return {
    service,
    comprador: { cliente, id: sesion.user.id, direccionId: direccion.id },
    tenderos,
    patinador,
    logistica,
    productos,
  };
}

async function crearPedidoPagado(ctx: Contexto, nota: string): Promise<{ id: string; code: string }> {
  const { status, body } = await createOrder(ctx.comprador.cliente, ctx.service, ctx.comprador.id, {
    order: {
      buyer_id: ctx.comprador.id,
      buyer_type: 'retail',
      status: 'pending',
      payment_status: 'pending',
      notes: `Demo de logística: ${nota}`,
      delivery_address_id: ctx.comprador.direccionId,
      client_idempotency_key: `demo-logistica-${crypto.randomUUID()}`,
    },
    items: ctx.productos.map((p) => ({
      store_product_id: p.id,
      quantity: 1,
      unit_price: p.precio,
      total_price: p.precio,
      catalog_name: p.nombre,
      unit_name: p.unidad,
    })),
    storeOrders: [],
  });

  const pedido = (body as any).data;
  if (status >= 400 || !pedido?.code) throw new Error(`No se pudo crear el pedido: ${(body as any).error ?? status}`);
  if (pedido.fulfillment !== 'consolidated') throw new Error(`El pedido ${pedido.code} no salió como pedido de varias tiendas.`);

  await payLocalOrder(ctx.service, pedido.code);
  return { id: pedido.id, code: pedido.code };
}

async function partesDe(ctx: Contexto, orderId: string): Promise<{ id: string; storeId: string }[]> {
  const { data } = await ctx.service.from('store_orders').select('id, store_id').eq('order_id', orderId).order('store_id');
  return (data ?? []).map((p) => ({ id: p.id, storeId: p.store_id }));
}

/** El tendero lleva su parte de «Confirmado» hasta `hasta`. */
async function avanzarTienda(ctx: Contexto, parte: { id: string; storeId: string }, hasta: 'packing' | 'at_collection') {
  const pasos = hasta === 'packing' ? ['packing'] : ['packing', 'at_collection'];
  for (const target of pasos) {
    await changeStoreOrderStatus(ctx.service, {
      storeOrderId: parte.id,
      target,
      notes: null,
      actorId: ctx.tenderos.get(parte.storeId) ?? ctx.comprador.id,
    });
  }
}

/** Logística recibe la parte con una foto subida a su carpeta temporal, como desde el celular. */
async function recibir(ctx: Contexto, storeOrderId: string): Promise<string | null> {
  const ticket = await createPhotoUploadTicket(ctx.service, LOGISTICS_BUCKET, ctx.logistica.userId, 'image/png');
  const { error } = await ctx.service.storage
    .from(LOGISTICS_BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, FOTO_DE_PRUEBA, { contentType: 'image/png' });
  if (error) throw new Error(`No se pudo subir la foto de prueba: ${error.message}`);

  const { deliveryError } = await receivePart(ctx.service, ctx.logistica, storeOrderId, {
    photos: [ticket.path],
    observation: 'Llegó completo y bien empacado (demo).',
    damaged: false,
  });
  return deliveryError;
}

async function llevarHasta(ctx: Contexto, etapa: Etapa, orderId: string): Promise<string | null> {
  const [primera, segunda] = await partesDe(ctx, orderId);

  if (etapa === 'preparando') {
    await avanzarTienda(ctx, primera, 'packing');
    return null;
  }

  await avanzarTienda(ctx, primera, 'at_collection');
  await avanzarTienda(ctx, segunda, 'at_collection');
  await collectPart(ctx.service, ctx.patinador, primera.id);
  if (etapa === 'recogiendo') return null;

  await collectPart(ctx.service, ctx.patinador, segunda.id);
  await markAtBay(ctx.service, ctx.patinador, orderId);
  if (etapa === 'en_bahia') return null;

  await recibir(ctx, primera.id);
  if (etapa === 'una_recibida') return null;

  return recibir(ctx, segunda.id);
}

async function main() {
  const ctx = await prepararContexto();

  console.log('Pedidos de demostración en Placita de Flórez:\n');
  for (const { etapa, texto } of ETAPAS) {
    const pedido = await crearPedidoPagado(ctx, texto);
    const errorMensajero = await llevarHasta(ctx, etapa, pedido.id);
    console.log(`  ${pedido.code}  ${texto}`);
    if (errorMensajero) console.log(`               (no se pudo pedir el mensajero: ${errorMensajero})`);
  }

  console.log(`\nEntra como ${CUENTAS.logistica} (logistica-local) a /admin/orders para verlos.`);
}

main().catch(exitWithError);
