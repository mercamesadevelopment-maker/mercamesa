import { NextResponse } from 'next/server';
import { accountingRequest, serverError } from '@/lib/accounting/route-helpers';
import { listCreditNotes } from '@/lib/accounting/credit-notes';

/** Las notas crédito de Siigo, con los filtros de Contabilidad. */
export async function GET(request: Request) {
  try {
    const r = await accountingRequest(request);
    if ('error' in r) return r.error;
    const { service, filters, scope, stores, page } = r.ctx;
    return NextResponse.json({ data: await listCreditNotes(service, filters, scope, stores, page) });
  } catch (error) {
    return serverError('admin/accounting/credit-notes GET', error);
  }
}
