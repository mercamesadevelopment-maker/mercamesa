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
    const { key, label, description, icon, path, parent_id, sort_order, is_active } = body;

    const { data, error } = await supabase
      .from('modules')
      .update({
        ...(key !== undefined && { key }),
        ...(label !== undefined && { label }),
        ...(description !== undefined && { description: description || null }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(path !== undefined && { path: path || null }),
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

export async function DELETE(
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

    const { data: canDelete } = await supabase.rpc('has_permission', {
      module_key: 'system-settings',
      action_name: 'delete',
    });

    if (!canDelete) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar módulos' }, { status: 403 });
    }

    // Verificar sub-módulos
    const { count: subCount, error: subError } = await supabase
      .from('modules')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id);

    if (subError) throw subError;

    if ((subCount ?? 0) > 0) {
      return NextResponse.json({
        error: `No se puede eliminar porque tiene ${subCount} sub-módulo(s) asociado(s).`
      }, { status: 400 });
    }

    // Limpiar permisos de roles asignados a este módulo
    await supabase.from('role_permissions').delete().eq('module_id', id);

    const { error } = await supabase
      .from('modules')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Módulo eliminado exitosamente' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
