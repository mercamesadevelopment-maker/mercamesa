import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { slugify, uniqueSlug } from '@/lib/catalog-import/slug';
import { replacePersonTypeLinks } from '@/lib/identification/links';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('identification_types')
      .select('*, person_type_identification_types ( person_type_id )')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Se aplana la tabla puente a la lista de ids que espera el formulario.
    const rows = (data ?? []).map((row: any) => ({
      ...row,
      person_type_ids: (row.person_type_identification_types ?? []).map(
        (link: any) => link.person_type_id as string
      ),
    }));

    return NextResponse.json({ data: rows }, { status: 200 });
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
      'No tienes permisos para crear tipos de identificación'
    );
    if (denied) return denied;

    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const code = String(body.code ?? '').trim();

    if (!name || !code) {
      return NextResponse.json({ error: 'El nombre y el código son requeridos' }, { status: 400 });
    }

    const { data: existing } = await supabase.from('identification_types').select('slug');
    const taken = new Set((existing ?? []).map((row) => row.slug as string));

    const { data, error } = await supabase
      .from('identification_types')
      .insert({
        name,
        code,
        slug: uniqueSlug(slugify(name) || 'identificacion', taken),
        sort_order: Number(body.sort_order ?? 0),
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (Array.isArray(body.person_type_ids)) {
      const linkError = await replacePersonTypeLinks(
        supabase,
        data.id,
        body.person_type_ids.map((value: unknown) => String(value))
      );
      if (linkError) {
        return NextResponse.json({ error: linkError }, { status: 400 });
      }
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
