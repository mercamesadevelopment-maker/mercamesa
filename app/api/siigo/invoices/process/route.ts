import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Json } from '@/types/database_generated';
import { SIIGO_MAX_INVOICE_ATTEMPTS, SIIGO_STAMP_SEND } from '@/lib/siigo/config';
import { createInvoice } from '@/lib/siigo/services/invoice.service';
import { ensureCustomer } from '@/lib/siigo/services/customer.service';
import {
  SiigoDataError,
  buildInvoicePayload,
  loadOrderInvoiceContext,
} from '@/lib/siigo/mappers/order-to-invoice';

/**
 * Emite en Siigo las facturas de los pedidos cuyo pago quedó aprobado.
 *
 * El encolado lo hace un trigger sobre `payments` (ver la migración
 * 20260826180000): las tres Edge Functions de ZonaPagos confirman pagos por
 * caminos distintos, y la base es el único punto por el que pasan todas.
 *
 * Se factura acá y no desde el trigger para que una caída de Siigo nunca
 * bloquee la confirmación del pago del comprador. Lo que falla se reintenta.
 */
export const maxDuration = 60;

/** Cuántas facturas se procesan por corrida. Siigo limita a 100 req/min. */
const BATCH_SIZE = 10;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();

  // `order_id` opcional para forzar un pedido puntual (ensayo en seco).
  const body = await request.json().catch(() => ({}));
  const onlyOrderId = typeof body?.order_id === 'string' ? body.order_id : null;

  let query = supabase
    .from('siigo_invoices')
    .select('id, order_id, attempts')
    .eq('status', 'pending')
    .lt('attempts', SIIGO_MAX_INVOICE_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (onlyOrderId) {
    query = supabase
      .from('siigo_invoices')
      .select('id, order_id, attempts')
      .eq('order_id', onlyOrderId);
  }

  const { data: pending, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const results: { order_id: string; status: string; message?: string }[] = [];

  for (const row of pending ?? []) {
    try {
      const ctx = await loadOrderInvoiceContext(supabase, row.order_id);

      // El tercero tiene que existir en Siigo antes de facturar. Se crea al
      // vuelo y se guarda la referencia para no repetir la búsqueda.
      const customer = await ensureCustomer(ctx.buyer);

      const payload = buildInvoicePayload(ctx);

      // `orders.code` como clave de idempotencia: si el reintento llega después
      // de que Siigo ya creó la factura, devuelve la existente en vez de otra.
      const invoice = await createInvoice(payload, ctx.orderCode);

      await supabase
        .from('siigo_invoices')
        .update({
          status: 'sent',
          siigo_invoice_id: invoice.id,
          siigo_number: invoice.number != null ? String(invoice.number) : null,
          stamped: SIIGO_STAMP_SEND,
          attempts: row.attempts + 1,
          last_error: null,
          request_payload: payload as unknown as Json,
          response_payload: invoice as unknown as Json,
        })
        .eq('id', row.id);

      if (customer?.id) {
        await supabase
          .from('profiles')
          .update({ siigo_customer_id: customer.id })
          .eq('document_number', ctx.buyer.identification)
          .is('siigo_customer_id', null);
      }

      sent++;
      results.push({ order_id: row.order_id, status: 'sent' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = row.attempts + 1;

      // Un SiigoDataError no se arregla reintentando: falta un dato en la base.
      // Se agota el contador de una para que no ocupe la cola en cada corrida.
      const isDataError = err instanceof SiigoDataError;

      await supabase
        .from('siigo_invoices')
        .update({
          status:
            isDataError || attempts >= SIIGO_MAX_INVOICE_ATTEMPTS ? 'failed' : 'pending',
          attempts: isDataError ? SIIGO_MAX_INVOICE_ATTEMPTS : attempts,
          last_error: message.slice(0, 2000),
        })
        .eq('id', row.id);

      failed++;
      results.push({ order_id: row.order_id, status: 'failed', message });
      console.error(`Error facturando el pedido ${row.order_id}:`, message);
    }
  }

  return NextResponse.json(
    { processed: pending?.length ?? 0, sent, failed, stamped: SIIGO_STAMP_SEND, results },
    { status: 200 }
  );
}
