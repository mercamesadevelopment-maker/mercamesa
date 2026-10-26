import { NextResponse } from 'next/server';
import { accountingRequest, serverError } from '@/lib/accounting/route-helpers';
import { listPayments } from '@/lib/accounting/payments';

/** Los pagos de los compradores, con los filtros de Contabilidad. */
export async function GET(request: Request) {
  try {
    const r = await accountingRequest(request);
    if ('error' in r) return r.error;
    const { service, filters, scope, stores, page } = r.ctx;
    return NextResponse.json({ data: await listPayments(service, filters, scope, stores, page) });
  } catch (error) {
    return serverError('admin/accounting/payments GET', error);
  }
}
