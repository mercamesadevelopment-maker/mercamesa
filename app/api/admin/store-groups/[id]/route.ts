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
      'No tienes permisos para editar grupos de tiendas'
    );
    if (denied) return denied;

    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const description =
      body.description !== undefined ? String(body.description).trim() || null : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
    }

    // El slug no se renombra: es identificador estable y cambiarlo no aporta
    // nada, porque quien elige el grupo lo hace siempre por nombre.
    const { data, error } = await supabase
      .from('store_groups')
      .update({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
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

/**
 * Asigna o quita tiendas del grupo. Se recibe la lista completa de tiendas que
 * deben quedar en él, para que la pantalla no tenga que calcular altas y bajas.
 */
export async function PATCH(
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
      'No tienes permisos para editar grupos de tiendas'
    );
    if (denied) return denied;

    const body = await request.json();
    if (!Array.isArray(body.store_ids)) {
      return NextResponse.json({ error: 'Se esperaba store_ids como lista.' }, { status: 400 });
    }

    const storeIds = body.store_ids.map((value: unknown) => String(value)).filter(Boolean);

    // Se calcula la diferencia en memoria en vez de armar un `not.in` con los
    // ids: son un puñado de tiendas y así no hay que construir filtros a mano.
    const { data: currentStores, error: currentError } = await supabase
      .from('stores')
      .select('id')
      .eq('store_group_id', id);

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 400 });
    }

    const keep = new Set(storeIds);
    const toRelease = (currentStores ?? [])
      .map((store) => store.id as string)
      .filter((storeId) => !keep.has(storeId));

    if (toRelease.length > 0) {
      const { error: releaseError } = await supabase
        .from('stores')
        .update({ store_group_id: null })
        .in('id', toRelease);

      if (releaseError) {
        return NextResponse.json({ error: releaseError.message }, { status: 400 });
      }
    }

    if (storeIds.length > 0) {
      const { error: assignError } = await supabase
        .from('stores')
        .update({ store_group_id: id })
        .in('id', storeIds);

      if (assignError) {
        return NextResponse.json({ error: assignError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ message: 'Tiendas del grupo actualizadas' }, { status: 200 });
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
      'No tienes permisos para eliminar grupos de tiendas'
    );
    if (denied) return denied;

    // Borrar un grupo vuelve públicos sus productos: cualquier tienda podría
    // publicarlos con sus fotos. Es reversible, pero no debe pasar por descuido,
    // así que se avisa cuántos productos están en juego y se exige confirmar.
    const { count, error: countError } = await supabase
      .from('catalog_products')
      .select('id', { count: 'exact', head: true })
      .eq('owner_group_id', id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }

    const confirmed = new URL(request.url).searchParams.get('confirm') === 'true';

    if ((count ?? 0) > 0 && !confirmed) {
      return NextResponse.json(
        {
          error: `Este grupo tiene ${count} producto(s) exclusivos. Si lo eliminas, esos productos quedarán públicos y cualquier tienda podrá publicarlos con sus imágenes.`,
          requiresConfirmation: true,
          productCount: count,
        },
        { status: 409 }
      );
    }

    // Las FK son ON DELETE SET NULL: los productos vuelven a ser públicos y las
    // tiendas quedan sin grupo, sin que se borre nada de ellos.
    const { error } = await supabase.from('store_groups').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Grupo eliminado' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
