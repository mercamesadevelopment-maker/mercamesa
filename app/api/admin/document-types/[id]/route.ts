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
      return NextResponse.json({ error: 'No tienes permisos para editar tipos de documento' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, is_required } = body;

    const { data, error } = await supabase
      .from('document_types')
      .update({
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(is_required !== undefined && { is_required }),
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
      return NextResponse.json({ error: 'No tienes permisos para eliminar tipos de documento' }, { status: 403 });
    }

    // Verificar en store_documents
    const { count: docCount, error: docError } = await supabase
      .from('store_documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_type_id', id);

    if (docError) throw docError;

    if ((docCount ?? 0) > 0) {
      return NextResponse.json({
        error: `No se puede eliminar porque hay ${docCount} documento(s) de tienda asociado(s).`
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('document_types')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Tipo de documento eliminado exitosamente' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
