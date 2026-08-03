import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('order_min_price_history')
      .select('*, profiles ( full_name )')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: canCreate } = await supabase.rpc('has_permission', {
      module_key: 'system-settings',
      action_name: 'create',
    });

    if (!canCreate) {
      return NextResponse.json({ error: 'No tienes permisos para ajustar el precio mínimo de orden' }, { status: 403 });
    }

    const body = await request.json();
    const { min_price, notes } = body;

    if (min_price === undefined || min_price === null || Number(min_price) < 0) {
      return NextResponse.json({ error: 'El precio mínimo es requerido y debe ser mayor o igual a cero' }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json({ error: 'La observación del ajuste es requerida' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('order_min_price_history')
      .insert({
        min_price: Number(min_price),
        notes,
        changed_by: user.id,
      })
      .select('*, profiles ( full_name )')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
