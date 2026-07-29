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
      return NextResponse.json({ error: 'No tienes permisos para editar unidades de medida' }, { status: 403 });
    }

    const body = await request.json();
    const { name, abbreviation, is_active } = body;

    const { data, error } = await supabase
      .from('measurement_units')
      .update({
        ...(name !== undefined && { name }),
        ...(abbreviation !== undefined && { abbreviation }),
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
      return NextResponse.json({ error: 'No tienes permisos para eliminar unidades de medida' }, { status: 403 });
    }

    // Verificar en catalog_products
    const { count: catProdCount, error: catError } = await supabase
      .from('catalog_products')
      .select('id', { count: 'exact', head: true })
      .eq('default_unit_id', id);

    if (catError) throw catError;

    if ((catProdCount ?? 0) > 0) {
      return NextResponse.json({
        error: `No se puede eliminar porque hay ${catProdCount} producto(s) del catálogo asignado(s) a esta unidad.`
      }, { status: 400 });
    }

    // Verificar en store_products
    const { count: storeProdCount, error: storeError } = await supabase
      .from('store_products')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', id);

    if (storeError) throw storeError;

    if ((storeProdCount ?? 0) > 0) {
      return NextResponse.json({
        error: `No se puede eliminar porque hay ${storeProdCount} producto(s) de tienda usando esta unidad.`
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('measurement_units')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Unidad de medida eliminada exitosamente' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
