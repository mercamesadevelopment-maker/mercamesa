import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uniqueViolationMessage, DUPLICATE_FALLBACK_MESSAGE } from '@/lib/db/unique-violation';
import { categorySlugMessage, categorySlugMap } from '@/lib/admin/settings-messages';

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

    // El slug es único en la base. Sin esta comprobación, editarlo con uno ya
    // usado devolvía el error crudo de Postgres —«duplicate key value violates
    // unique constraint "categories_slug_key"»— que no dice qué corregir.
    // `neq('id', id)` es lo que permite guardar una categoría sin cambiarle el
    // slug: si no, chocaría consigo misma.
    if (slug !== undefined) {
      const { data: enUso } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .maybeSingle();

      if (enUso) {
        return NextResponse.json({ error: categorySlugMessage(slug) }, { status: 400 });
      }
    }

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
      // Respaldo por si dos administradores guardan el mismo slug a la vez.
      const message =
        uniqueViolationMessage(error, categorySlugMap(String(slug))) ??
        (error.code === '23505' ? DUPLICATE_FALLBACK_MESSAGE : 'No se pudo guardar la categoría.');

      console.error('Error actualizando categoría:', error.message);
      return NextResponse.json({ error: message }, { status: 400 });
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
