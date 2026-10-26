import { NextResponse } from 'next/server';
import { accountingRequest, serverError } from '@/lib/accounting/route-helpers';

/** Tiendas y plazas para los filtros de Contabilidad. */
export async function GET(request: Request) {
  try {
    const r = await accountingRequest(request);
    if ('error' in r) return r.error;
    return NextResponse.json({ data: r.ctx.stores.options });
  } catch (error) {
    return serverError('admin/accounting/options GET', error);
  }
}
