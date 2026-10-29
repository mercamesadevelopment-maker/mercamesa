import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canManageStore, isPlatformAdmin } from '@/lib/auth/can-manage-store';
import { getStore } from '@/lib/stores/store-listing';
import { updateStore } from '@/lib/stores/store-update';
import { deleteStore } from '@/lib/stores/store-delete';

type Params = { params: Promise<{ id: string }> };

const errorInterno = (error: unknown) =>
  NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { status, body } = await getStore(supabase, id, user?.id ?? null);
  return NextResponse.json(body, { status });
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Antes esta ruta solo comprobaba que hubiera sesión, y `stores` no tiene
    // RLS: cualquier usuario autenticado podía renombrar, mover de plaza o
    // reemplazar el logo de CUALQUIER tienda.
    if (!(await canManageStore(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }

    const isAdmin = await isPlatformAdmin(supabase, user.id);
    const { status, body } = await updateStore(supabase, id, await request.json(), isAdmin);
    return NextResponse.json(body, { status });
  } catch (error: unknown) {
    return errorInterno(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Borrar una tienda arrastra sus productos, pedidos y miembros. No es una
    // acción de tendero: se reserva a la plataforma.
    if (!(await isPlatformAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Solo el equipo de MercaMesa puede eliminar una tienda.' }, { status: 403 });
    }

    const { status, body } = await deleteStore(supabase, id);
    return NextResponse.json(body, { status });
  } catch (error: unknown) {
    return errorInterno(error);
  }
}
