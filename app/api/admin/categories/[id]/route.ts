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
      return NextResponse.json({ error: 'No tienes permisos para editar categorías' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, parent_id, sort_order, is_active } = body;

    const { data, error } = await supabase
      .from('categories')
      .update({
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(description !== undefined && { description: description || null }),
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
      return NextResponse.json({ error: 'No tienes permisos para eliminar categorías' }, { status: 403 });
    }

    // Verificar si hay productos asociados a esta categoría
    const { count: productCount, error: countError } = await supabase
      .from('catalog_products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countError) throw countError;

    if ((productCount ?? 0) > 0) {
      return NextResponse.json({
        error: `No se puede eliminar la categoría porque hay ${productCount} producto(s) asociado(s).`
      }, { status: 400 });
    }

    // Verificar si hay subcategorías
    const { count: subCount, error: subError } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id);

    if (subError) throw subError;

    if ((subCount ?? 0) > 0) {
      return NextResponse.json({
        error: `No se puede eliminar porque tiene ${subCount} subcategoría(s) asociada(s).`
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Categoría eliminada exitosamente' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
