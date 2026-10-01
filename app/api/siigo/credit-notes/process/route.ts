import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Json } from '@/types/database_generated';
import {
  SIIGO_DELIVERY_PRODUCT_CODE,
  SIIGO_MAX_INVOICE_ATTEMPTS,
  SIIGO_NC_DOCUMENT_ID,
  SIIGO_PLATFORM_PRODUCT_CODE,
  SIIGO_STAMP_SEND,
} from '@/lib/siigo/config';
import { createCreditNote } from '@/lib/siigo/services/credit-note.service';
import { SiigoDataError } from '@/lib/siigo/mappers/order-to-invoice';
import { buildCreditNotePayload, type CreditNoteContext } from '@/lib/siigo/mappers/refund-to-credit-note';

/**
 * Emite en Siigo las notas crédito de las devoluciones aprobadas.
 *
 * Es el espejo de `/api/siigo/invoices/process`: la cola la llena un trigger
 * sobre `order_refunds` y acá se vacía. El comprador ya tiene su saldo a favor
 * desde que se aprobó la devolución; esto es solo el registro contable, y si
 * Siigo falla se reintenta.
 *
 * Una nota crédito corrige una factura, así que no puede salir antes que ella:
 * mientras la factura del pedido no esté emitida, la nota espera sin gastar
 * intentos.
 */
export const maxDuration = 60;

const BATCH_SIZE = 10;

/** El pedido se cobró pero su factura no se va a emitir: no hay qué corregir. */
const SIN_FACTURA = 'El pedido no tiene factura en Siigo, así que no hay nada que corregir con una nota crédito.';

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Sin el tipo de comprobante no se sabe qué documento contable emitir. No se
  // toca la cola: las devoluciones esperan a que se configure.
  if (!SIIGO_NC_DOCUMENT_ID) {
    return NextResponse.json(
      { processed: 0, configured: false, message: 'Falta SIIGO_NC_DOCUMENT_ID.' },
      { status: 200 }
    );
  }

  const supabase = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

  const { data: pending, error } = await supabase
    .from('siigo_credit_notes')
    .select('id, refund_id, attempts')
    .eq('status', 'pending')
    .lt('attempts', SIIGO_MAX_INVOICE_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let waiting = 0;
  const results: { refund_id: string; status: string; message?: string }[] = [];

  for (const row of pending ?? []) {
    try {
      const cargado = await loadCreditNoteContext(supabase, row.refund_id);

      if (cargado.estado === 'esperando') {
        waiting++;
        results.push({ refund_id: row.refund_id, status: 'waiting_invoice' });
        continue;
      }

      if (cargado.estado === 'sin_factura') {
        await supabase
          .from('siigo_credit_notes')
          .update({ status: 'skipped', last_error: SIN_FACTURA })
          .eq('id', row.id);
        results.push({ refund_id: row.refund_id, status: 'skipped' });
        continue;
      }

      const payload = buildCreditNotePayload(cargado.ctx);
      const note = await createCreditNote(payload, `NC${cargado.ctx.pqrsCode}`);

      await supabase
        .from('siigo_credit_notes')
        .update({
          status: 'sent',
          siigo_credit_note_id: note.id,
          siigo_number: note.number != null ? String(note.number) : null,
          stamped: SIIGO_STAMP_SEND,
          attempts: row.attempts + 1,
          last_error: null,
          request_payload: payload as unknown as Json,
          response_payload: note as unknown as Json,
        })
        .eq('id', row.id);

      sent++;
      results.push({ refund_id: row.refund_id, status: 'sent' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = row.attempts + 1;
      // Un error de datos no se arregla reintentando.
      const isDataError = err instanceof SiigoDataError;

      await supabase
        .from('siigo_credit_notes')
        .update({
          status: isDataError || attempts >= SIIGO_MAX_INVOICE_ATTEMPTS ? 'failed' : 'pending',
          attempts: isDataError ? SIIGO_MAX_INVOICE_ATTEMPTS : attempts,
          last_error: message.slice(0, 2000),
        })
        .eq('id', row.id);

      failed++;
      results.push({ refund_id: row.refund_id, status: 'failed', message });
      console.error(`Error emitiendo la nota crédito de la devolución ${row.refund_id}:`, message);
    }
  }

  return NextResponse.json(
    { processed: pending?.length ?? 0, sent, failed, waiting, stamped: SIIGO_STAMP_SEND, results },
    { status: 200 }
  );
}

type Cargado =
  | { estado: 'listo'; ctx: CreditNoteContext }
  | { estado: 'esperando' }
  | { estado: 'sin_factura' };

/**
 * Todo lo que la nota necesita, o por qué todavía no se puede armar.
 */
async function loadCreditNoteContext(supabase: SupabaseClient<any>, refundId: string): Promise<Cargado> {
  const { data: refund, error } = await supabase
    .from('order_refunds')
    .select(
      `id, order_id, scope, products_amount, service_commission_amount, platform_commission_amount, total_amount,
       pqrs ( code ),
       orders ( code ),
       order_refund_items (
         quantity, amount,
         order_items ( catalog_name, store_products ( catalog_products ( siigo_id ) ) )
       )`
    )
    .eq('id', refundId)
    .single();

  if (error || !refund) {
    throw new SiigoDataError(`No se encontró la devolución ${refundId}: ${error?.message ?? ''}`);
  }

  const { data: factura } = await supabase
    .from('siigo_invoices')
    .select('status, siigo_invoice_id, request_payload')
    .eq('order_id', refund.order_id)
    .maybeSingle();

  // Sin fila, o con la factura todavía en cola: la nota espera.
  if (!factura || factura.status === 'pending') return { estado: 'esperando' };
  if (factura.status !== 'sent' || !factura.siigo_invoice_id) return { estado: 'sin_factura' };

  const { data: pricingRow } = await supabase
    .from('pricing_settings_history')
    .select('siigo_delivery_product_code, siigo_platform_product_code')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    estado: 'listo',
    ctx: {
      pqrsCode: (refund as any).pqrs?.code ?? refundId,
      orderCode: (refund as any).orders?.code ?? '',
      siigoInvoiceId: factura.siigo_invoice_id,
      invoiceRequest: (factura.request_payload ?? { items: [] }) as CreditNoteContext['invoiceRequest'],
      scope: refund.scope,
      products: Number(refund.products_amount),
      serviceCommission: Number(refund.service_commission_amount),
      platformCommission: Number(refund.platform_commission_amount),
      total: Number(refund.total_amount),
      items: ((refund as any).order_refund_items ?? []).map((i: any) => ({
        siigoCode: i.order_items?.store_products?.catalog_products?.siigo_id ?? null,
        description: i.order_items?.catalog_name ?? 'Producto',
        quantity: Number(i.quantity),
        amount: Number(i.amount),
      })),
      deliveryProductCode: pricingRow?.siigo_delivery_product_code || SIIGO_DELIVERY_PRODUCT_CODE,
      platformProductCode: pricingRow?.siigo_platform_product_code || SIIGO_PLATFORM_PRODUCT_CODE,
    },
  };
}
