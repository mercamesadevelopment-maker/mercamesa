import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: canUpdate } = await supabase.rpc('has_permission', {
      module_key: 'system-settings',
      action_name: 'update',
    });

    if (!canUpdate) {
      return NextResponse.json({ error: 'No tienes permisos para editar módulos' }, { status: 403 });
    }

    const body = await request.json();
    // `key` y `path` no se toman aunque vengan: el código busca los módulos por
    // clave (`has_permission`) y `proxy.ts` por ruta. Cambiarlos desde la
    // pantalla rompía permisos o dejaba una página sin protección fina.
    const { label, description, icon, parent_id, sort_order, is_active } = body;

    const { data, error } = await supabase
      .from('modules')
      .update({
        ...(label !== undefined && { label }),
        ...(description !== undefined && { description: description || null }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(parent_id !== undefined && { parent_id: parent_id || null }),
        ...(sort_order !== undefined && { sort_order }),
        ...(is_active !== undefined && { is_active }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
