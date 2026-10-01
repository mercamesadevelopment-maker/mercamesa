import { NextResponse } from 'next/server';
import { withPqrsActor } from '@/lib/pqrs/route-helpers';
import { listPqrs } from '@/lib/pqrs/queries';
import { createPqrs } from '@/lib/pqrs/create';
import type { PqrsStatus, PqrsViewer } from '@/lib/pqrs/types';

const SCOPES: PqrsViewer[] = ['buyer', 'seller', 'admin'];
const STATUSES: PqrsStatus[] = ['awaiting_store', 'in_review', 'resolved'];

/** El listado de quien pregunta: sus casos, los de su tienda o todos (admin). */
export function GET(request: Request) {
  return withPqrsActor(request, async ({ service, actor }) => {
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get('scope') as PqrsViewer;
    const status = searchParams.get('status') as PqrsStatus | null;

    const data = await listPqrs(service, actor, {
      scope: SCOPES.includes(scope) ? scope : 'buyer',
      status: status && STATUSES.includes(status) ? status : null,
      storeId: searchParams.get('store_id'),
      page: Number(searchParams.get('page')) || 1,
    });

    return NextResponse.json({ data }, { status: 200 });
  });
}

/** Radicar. */
export function POST(request: Request) {
  return withPqrsActor(request, async ({ service, actor }) => {
    const body = await request.json().catch(() => ({}));
    const data = await createPqrs(service, actor, body);
    return NextResponse.json({ data }, { status: 201 });
  });
}
