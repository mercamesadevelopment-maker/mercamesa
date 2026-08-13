import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Catálogo público de tipos de persona con las identificaciones que admite cada
 * uno. Deliberadamente SIN autenticación: lo consume el modal de registro, que
 * usa gente que todavía no tiene cuenta.
 *
 * Por eso las políticas de estas tres tablas dan SELECT a `anon` además de a
 * `authenticated`, a diferencia del resto de catálogos. Si fueran solo
 * `authenticated`, un visitante recibiría `[]` con status 200 y los
 * desplegables saldrían vacíos sin ningún error visible.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('person_types')
      .select(
        `id, name, slug, requires_business_name, sort_order,
         person_type_identification_types (
           identification_types ( id, name, code, slug, sort_order, is_active )
         )`
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Se aplana la tabla puente para que el cliente reciba algo directamente
    // pintable, y se filtran las identificaciones inactivas acá: PostgREST no
    // permite filtrar por una columna de la tabla anidada sin excluir también
    // al padre.
    const personTypes = (data ?? []).map((personType: any) => ({
      id: personType.id,
      name: personType.name,
      slug: personType.slug,
      requires_business_name: personType.requires_business_name,
      identification_types: (personType.person_type_identification_types ?? [])
        .map((link: any) => link.identification_types)
        .filter((type: any) => type && type.is_active)
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((type: any) => ({
          id: type.id,
          name: type.name,
          code: type.code,
          slug: type.slug,
        })),
    }));

    return NextResponse.json({ data: personTypes }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
