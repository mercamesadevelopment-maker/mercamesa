import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { replacePersonTypeLinks } from '@/lib/identification/links';

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
      'No tienes permisos para editar tipos de identificación'
    );
    if (denied) return denied;

    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const code = body.code !== undefined ? String(body.code).trim() : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
    }
    if (code !== undefined && !code) {
      return NextResponse.json({ error: 'El código no puede quedar vacío' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('identification_types')
      .update({
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(body.sort_order !== undefined && { sort_order: Number(body.sort_order) }),
        ...(body.is_active !== undefined && { is_active: Boolean(body.is_active) }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (Array.isArray(body.person_type_ids)) {
      const linkError = await replacePersonTypeLinks(
        supabase,
        id,
        body.person_type_ids.map((value: unknown) => String(value))
      );
      if (linkError) {
        return NextResponse.json({ error: linkError }, { status: 400 });
      }
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
      'No tienes permisos para eliminar tipos de identificación'
    );
    if (denied) return denied;

    // Las FK son ON DELETE RESTRICT: la base lo impediría igual, pero acá se
    // cuenta antes para decir cuántos registros lo usan en vez de devolver el
    // error crudo de Postgres.
    const [{ count: profileCount }, { count: clientCount }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('identification_type_id', id),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('identification_type_id', id),
    ]);

    const inUse = (profileCount ?? 0) + (clientCount ?? 0);

    if (inUse > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: lo usan ${profileCount ?? 0} usuario(s) y ${clientCount ?? 0} cliente(s). Desactívalo para que deje de aparecer en los formularios sin perder esos datos.`,
        },
        { status: 400 }
      );
    }

    // Las filas de la tabla puente caen solas (ON DELETE CASCADE).
    const { error } = await supabase.from('identification_types').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Tipo de identificación eliminado' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
