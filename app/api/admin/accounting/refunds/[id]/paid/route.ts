import { NextResponse } from 'next/server';
import { accountingRequest } from '@/lib/accounting/route-helpers';
import { markRefundPaidById } from '@/lib/pqrs/refunds';
import { PqrsInputError } from '@/lib/pqrs/errors';

/**
 * Deja la constancia de que una devolución en dinero ya se pagó por fuera
 * (transferencia), con su referencia. Es lo mismo que hace el admin desde la
 * PQRS; aquí lo puede hacer también el auxiliar contable.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await accountingRequest(request, 'update');
    if ('error' in r) return r.error;
    const { service, userId } = r.ctx;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const reference = typeof body.reference === 'string' ? body.reference.trim().slice(0, 120) : '';
    if (!reference) {
      return NextResponse.json({ error: 'Escribe la referencia de la transferencia.' }, { status: 400 });
    }

    const { data: refund } = await service.from('order_refunds').select('id').eq('id', id).maybeSingle();
    if (!refund) return NextResponse.json({ error: 'La devolución no existe.' }, { status: 404 });

    await markRefundPaidById(service, refund.id, userId, reference);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PqrsInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('admin/accounting/refunds/paid POST:', error);
    return NextResponse.json({ error: 'No se pudo registrar el pago.' }, { status: 500 });
  }
}
