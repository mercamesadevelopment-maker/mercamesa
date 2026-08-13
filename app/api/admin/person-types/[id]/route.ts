import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'update',
      'No tienes permisos para editar tipos de persona'
    );
    if (denied) return denied;

    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
    }

    // El slug no se renombra: es identificador estable y quien elige el tipo lo
    // hace siempre por nombre.
    const { data, error } = await supabase
      .from('person_types')
      .update({
        ...(name !== undefined && { name }),
        ...(body.requires_business_name !== undefined && {
          requires_business_name: body.requires_business_name === true,
        }),
        ...(body.sort_order !== undefined && { sort_order: Number(body.sort_order) }),
        ...(body.is_active !== undefined && { is_active: Boolean(body.is_active) }),
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

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'delete',
      'No tienes permisos para eliminar tipos de persona'
    );
    if (denied) return denied;

    // La FK es ON DELETE RESTRICT, así que la base lo impediría igual; acá se
    // hace antes para poder decir cuántos perfiles lo usan en vez de devolver
    // el error crudo de Postgres.
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('person_type_id', id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: ${count} usuario(s) tienen este tipo de persona. Desactívalo para que deje de aparecer en los formularios sin perder esos datos.`,
        },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('person_types').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Tipo de persona eliminado' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
