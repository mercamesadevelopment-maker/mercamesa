import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { uniqueSlug } from '@/lib/catalog-import/slug';

/**
 * Grupos de tiendas: la unidad de propiedad del catálogo maestro.
 *
 * Un producto con `owner_group_id` solo lo pueden publicar las tiendas del
 * grupo. Existe para que quien aporta productos con sus propias fotos no vea a
 * otras tiendas reutilizarlas, y para que un mismo comerciante con varias
 * tiendas las comparta entre ellas.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Se traen las tiendas de cada grupo: la pantalla los administra juntos y
    // sin ellas no se sabría a quién afecta borrar un grupo.
    const { data, error } = await supabase
      .from('store_groups')
      .select('*, stores ( id, name, slug )')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'create',
      'No tienes permisos para crear grupos de tiendas'
    );
    if (denied) return denied;

    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const description = String(body.description ?? '').trim() || null;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // El slug se genera acá y no lo escribe el admin: es identificador interno,
    // y el `unique` de la base convertiría un choque en un error críptico.
    const { data: existing } = await supabase.from('store_groups').select('slug');
    const taken = new Set((existing ?? []).map((group) => group.slug as string));
    const slug = uniqueSlug(name, taken);

    const { data, error } = await supabase
      .from('store_groups')
      .insert({ name, slug, description })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
