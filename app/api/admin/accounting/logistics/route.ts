import { NextResponse } from 'next/server';
import { accountingRequest, serverError } from '@/lib/accounting/route-helpers';
import { loadLogisticsReport } from '@/lib/accounting/logistics';

/** Qué plazas tienen logística y cuántos servicios prestó cada una, en total y por día. */
export async function GET(request: Request) {
  try {
    const r = await accountingRequest(request);
    if ('error' in r) return r.error;
    return NextResponse.json({ data: await loadLogisticsReport(r.ctx.service, r.ctx.filters) });
  } catch (error) {
    return serverError('admin/accounting/logistics GET', error);
  }
}
