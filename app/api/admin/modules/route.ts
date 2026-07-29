import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('modules')
      .select('*, parent:modules!parent_id(label)')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

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
      return NextResponse.json({ error: 'No tienes permisos para crear módulos' }, { status: 403 });
    }

    const body = await request.json();
    const { key, label, description, icon, path, parent_id, sort_order, is_active } = body;

    if (!key || !label) {
      return NextResponse.json({ error: 'La clave (key) y la etiqueta (label) son requeridas' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('modules')
      .insert({
        key,
        label,
        description: description || null,
        icon: icon || null,
        path: path || null,
        parent_id: parent_id || null,
        sort_order: sort_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
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
