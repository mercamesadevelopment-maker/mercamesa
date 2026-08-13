import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { slugify, uniqueSlug } from '@/lib/catalog-import/slug';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('person_types')
      .select('*')
      .order('sort_order', { ascending: true })
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
      'No tienes permisos para crear tipos de persona'
    );
    if (denied) return denied;

    const body = await request.json();
    const name = String(body.name ?? '').trim();

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // El slug se genera acá: es identificador interno y el `unique` de la base
    // convertiría un choque en un error críptico.
    const { data: existing } = await supabase.from('person_types').select('slug');
    const taken = new Set((existing ?? []).map((row) => row.slug as string));

    const { data, error } = await supabase
      .from('person_types')
      .insert({
        name,
        slug: uniqueSlug(slugify(name) || 'tipo-persona', taken),
        requires_business_name: body.requires_business_name === true,
        sort_order: Number(body.sort_order ?? 0),
        is_active: body.is_active ?? true,
      })
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
