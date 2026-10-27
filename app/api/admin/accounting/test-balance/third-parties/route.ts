import { NextResponse } from 'next/server';
import { accountingAuth, serverError } from '@/lib/accounting/route-helpers';
import { searchSiigoBuyers } from '@/lib/accounting/test-balance';
import { sanitizeSearch } from '@/lib/accounting/filters';

/** Compradores que ya son terceros en Siigo, para el balance por tercero. */
export async function GET(request: Request) {
  try {
    const auth = await accountingAuth();
    if ('error' in auth) return auth.error;

    const q = sanitizeSearch(new URL(request.url).searchParams.get('q') ?? '').slice(0, 80);
    if (q.length < 2) return NextResponse.json({ data: [] });

    return NextResponse.json({ data: await searchSiigoBuyers(auth.service, q) });
  } catch (error) {
    return serverError('admin/accounting/test-balance/third-parties GET', error);
  }
}
