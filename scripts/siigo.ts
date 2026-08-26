/**
 * scripts/siigo.ts
 *
 * Operaciones de Siigo desde la línea de comandos.
 *
 * Existe por lo mismo que scripts/pibox-webhooks.ts: son tareas de puesta en
 * marcha y verificación que se ejecutan una vez, no cosas que merezcan una
 * pantalla. Además la sincronización del catálogo son miles de peticiones a
 * Siigo, que no caben en el tiempo de una función serverless.
 *
 * Uso (sin `--`: pnpm lo pasaría como un argumento literal más):
 *   pnpm siigo status                    Qué falta por sincronizar
 *   pnpm siigo sync-products             Sube a Siigo los productos faltantes
 *   pnpm siigo sync-products 100         Sube solo los primeros N (prueba)
 *   pnpm siigo preview <ORDER_CODE>      Arma la factura y la MUESTRA, sin enviarla
 *   pnpm siigo invoice <ORDER_CODE>      Crea la factura de verdad en Siigo
 *
 * Requiere SIIGO_USERNAME, SIIGO_ACCESS_KEY y SUPABASE_SERVICE_ROLE_KEY.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createProduct } from '../lib/siigo/services/products/product.service';
import { createInvoice } from '../lib/siigo/services/invoice.service';
import { ensureCustomer } from '../lib/siigo/services/customer.service';
import {
  SiigoDataError,
  buildInvoicePayload,
  loadOrderInvoiceContext,
} from '../lib/siigo/mappers/order-to-invoice';
import { SIIGO_STAMP_SEND } from '../lib/siigo/config';

const ACCOUNT_GROUP_ID = Number.parseInt(process.env.SIIGO_ACCOUNT_GROUP_ID || '1303', 10);

/**
 * Siigo permite 100 peticiones por minuto por empresa, y su documentación avisa
 * que bloquea usuarios con más del 80% de errores en 7 días. Con 3.500 productos
 * por subir, ir sin freno es la forma más rápida de que le suspendan la cuenta
 * al cliente. 700 ms entre peticiones deja ~85 por minuto, con margen.
 */
const REQUEST_DELAY_MS = Number.parseInt(process.env.SIIGO_REQUEST_DELAY_MS || '700', 10);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function status() {
  const supabase = db();

  const [{ count: total }, { count: pending }] = await Promise.all([
    supabase.from('catalog_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('catalog_products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('siigo_synced_at', null),
  ]);

  console.log('Catálogo:');
  console.log(`  activos en Mercamesa : ${total ?? 0}`);
  console.log(`  ya sincronizados     : ${(total ?? 0) - (pending ?? 0)}`);
  console.log(`  PENDIENTES           : ${pending ?? 0}`);

  const { data: invoices } = await supabase.from('siigo_invoices').select('status');
  const counts = (invoices ?? []).reduce<Record<string, number>>((acc, row: any) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\nFacturas encoladas:');
  if (Object.keys(counts).length === 0) console.log('  (ninguna todavía)');
  for (const [state, n] of Object.entries(counts)) console.log(`  ${state}: ${n}`);
}

async function syncProducts(limitArg?: string) {
  const supabase = db();
  const limit = limitArg ? Number.parseInt(limitArg, 10) : Infinity;

  let created = 0;
  let alreadyThere = 0;
  let failed = 0;
  let processed = 0;

  console.log('Sincronizando productos con Siigo...\n');
  console.log(`Ritmo: una peticion cada ${REQUEST_DELAY_MS} ms para no exceder el limite de Siigo.`);

  // Se procesa en tandas releyendo la tabla: `siigo_synced_at` cambia sobre la
  // marcha, así que siempre se piden "los siguientes pendientes".
  for (;;) {
    if (processed >= limit) break;

    const batchSize = Math.min(50, limit - processed);
    const { data: pending, error } = await supabase
      .from('catalog_products')
      .select('id, name, siigo_id, measurement_units ( name )')
      .eq('is_active', true)
      .is('siigo_synced_at', null)
      .order('id')
      .limit(batchSize);

    if (error) {
      console.error('Error leyendo el catálogo:', error.message);
      process.exit(1);
    }
    if (!pending || pending.length === 0) break;

    for (const product of pending as any[]) {
      try {
        const result = await createProduct({
          code: product.siigo_id,
          name: product.name,
          account_group: ACCOUNT_GROUP_ID,
          type: 'Product',
          stock_control: false,
          active: true,
          unit_label: product.measurement_units?.name || 'Unidad',
        });

        await supabase
          .from('catalog_products')
          .update({ siigo_synced_at: new Date().toISOString() })
          .eq('id', product.id);

        if (result.alreadyExists) alreadyThere++;
        else created++;
      } catch (err: unknown) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ ${product.name}: ${message.slice(0, 200)}`);
      }

      processed++;
      if (processed % 50 === 0) {
        console.log(`  ... ${processed} procesados (${created} creados, ${alreadyThere} ya existían, ${failed} con error)`);
      }

      // Freno para no pasarse del límite de Siigo (100 req/min por empresa).
      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    }
  }

  console.log('\nResultado:');
  console.log(`  creados en Siigo : ${created}`);
  console.log(`  ya existían      : ${alreadyThere}`);
  console.log(`  con error        : ${failed}`);

  const { count: remaining } = await supabase
    .from('catalog_products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('siigo_synced_at', null);

  console.log(`  quedan pendientes: ${remaining ?? 0}`);
}

async function resolveOrderId(orderCode: string): Promise<string> {
  const supabase = db();
  const { data } = await supabase
    .from('orders')
    .select('id, code')
    .eq('code', orderCode)
    .maybeSingle();

  if (!data) {
    console.error(`No existe el pedido ${orderCode}.`);
    process.exit(1);
  }
  return data.id;
}

async function preview(orderCode: string) {
  const supabase = db();
  const orderId = await resolveOrderId(orderCode);

  try {
    const ctx = await loadOrderInvoiceContext(supabase, orderId);
    const payload = buildInvoicePayload(ctx);
    console.log(`Factura que se enviaría por el pedido ${orderCode}:\n`);
    console.log(JSON.stringify(payload, null, 2));
    console.log(`\nTercero: ${ctx.buyer.identification} (${ctx.buyer.fullName ?? 'sin nombre'})`);
    console.log(`Transmisión a la DIAN: ${SIIGO_STAMP_SEND ? 'SÍ (SIIGO_STAMP_SEND=true)' : 'no'}`);
  } catch (err: unknown) {
    if (err instanceof SiigoDataError) {
      console.error(`No se puede facturar: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

async function invoice(orderCode: string) {
  const supabase = db();
  const orderId = await resolveOrderId(orderCode);

  const ctx = await loadOrderInvoiceContext(supabase, orderId);
  const payload = buildInvoicePayload(ctx);

  console.log(`Tercero: buscando/creando ${ctx.buyer.identification}...`);
  const customer = await ensureCustomer(ctx.buyer);
  console.log(`  ok (${customer.id})`);

  console.log(`Creando factura del pedido ${orderCode}...`);
  console.log(`  transmisión a la DIAN: ${SIIGO_STAMP_SEND ? 'SÍ' : 'no'}`);

  const created = await createInvoice(payload, ctx.orderCode);
  console.log(`  ok — id ${created.id}${created.number ? `, número ${created.number}` : ''}`);

  await supabase
    .from('siigo_invoices')
    .upsert(
      {
        order_id: orderId,
        status: 'sent',
        siigo_invoice_id: created.id,
        siigo_number: created.number != null ? String(created.number) : null,
        stamped: SIIGO_STAMP_SEND,
        request_payload: payload as any,
        response_payload: created as any,
      },
      { onConflict: 'order_id' }
    );

  console.log('Registrado en siigo_invoices.');
}

async function main() {
  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case 'status':
      await status();
      break;
    case 'sync-products':
      await syncProducts(arg);
      break;
    case 'preview':
      if (!arg) {
        console.error('Falta el código del pedido. Ej: pnpm siigo preview MM-2026-001017');
        process.exit(1);
      }
      await preview(arg);
      break;
    case 'invoice':
      if (!arg) {
        console.error('Falta el código del pedido. Ej: pnpm siigo invoice MM-2026-001017');
        process.exit(1);
      }
      await invoice(arg);
      break;
    default:
      console.log('Comandos: status | sync-products [N] | preview <ORDER_CODE> | invoice <ORDER_CODE>');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
