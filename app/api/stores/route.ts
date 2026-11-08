import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { listStores } from '@/lib/stores/store-listing';
import { createStore } from '@/lib/stores/store-create';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { status, body } = await listStores(supabase, new URL(request.url).searchParams, user?.id ?? null);
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const denied = await requirePermission(supabase, 'stores', 'create', 'No tienes permisos para crear tiendas');
    if (denied) return denied;

    const { status, body } = await createStore(
      supabase,
      createSupabaseServiceClient(),
      user.id,
      await request.json(),
      request.headers.get('origin') || ''
    );
    return NextResponse.json(body, { status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
