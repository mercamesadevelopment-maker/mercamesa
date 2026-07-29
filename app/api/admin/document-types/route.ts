import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_types')
      .select('*')
      .order('name', { ascending: true });

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
      return NextResponse.json({ error: 'No tienes permisos para crear tipos de documento' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, is_required } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'El nombre y el slug son requeridos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('document_types')
      .insert({
        name,
        slug,
        is_required: is_required ?? true,
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
