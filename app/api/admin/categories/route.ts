import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { embeddedCount } from '@/lib/db/embedded-count';
import { uniqueViolationMessage, DUPLICATE_FALLBACK_MESSAGE } from '@/lib/db/unique-violation';
import { categorySlugMessage, categorySlugMap } from '@/lib/admin/settings-messages';

export async function GET() {
  try {
    const supabase = await createClient();

    // `categories` se auto-referencia, así que hay que decirle a PostgREST en
    // qué dirección resolver la relación, y la pista tiene que ser la COLUMNA
    // (`parent_id`), no la tabla. Con `categories!parent_id` interpretaba la
    // dirección contraria y devolvía el arreglo de hijos, así que `parent.name`
    // quedaba indefinido y toda la tabla se mostraba como "Raíz".
    //
    // Esa misma dirección "contraria" es justo la que sirve para contar los
    // hijos. Los conteos viajan con el listado para poder avisar qué categoría
    // no se puede borrar ANTES de que alguien lo intente, en vez de dejarlo
    // confirmar y responderle que no con un error.
    const { data, error } = await supabase
      .from('categories')
      .select('*, parent:parent_id(name), catalog_products(count), children:categories!parent_id(count)')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // El agregado llega como `[{ count: n }]`; la interfaz solo necesita el número.
    const withCounts = (data ?? []).map((row: any) => {
      const { catalog_products, children, ...category } = row;
      return {
        ...category,
        product_count: embeddedCount(catalog_products),
        child_count: embeddedCount(children),
      };
    });

    return NextResponse.json({ data: withCounts }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: canCreate } = await supabase.rpc('has_permission', {
      module_key: 'system-settings',
      action_name: 'create',
    });

    if (!canCreate) {
      return NextResponse.json({ error: 'No tienes permisos para crear categorías' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, parent_id, sort_order, is_active } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'El nombre y el slug son requeridos' }, { status: 400 });
    }

    // Se comprueba antes para poder responder la frase buena sin depender de que
    // la base falle. El 23505 de más abajo sigue haciendo falta: entre esta
    // consulta y el insert, otro administrador puede usar el mismo slug.
    const { data: yaExiste } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (yaExiste) {
      return NextResponse.json({ error: categorySlugMessage(slug) }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        slug,
        description: description || null,
        parent_id: parent_id || null,
        sort_order: sort_order ?? 0,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      // Nunca se devuelve el mensaje crudo de Postgres: `duplicate key value
      // violates unique constraint "categories_slug_key"` no le dice a nadie
      // qué campo corregir, y expone nombres de índices.
      const message =
        uniqueViolationMessage(error, categorySlugMap(slug)) ??
        (error.code === '23505' ? DUPLICATE_FALLBACK_MESSAGE : 'No se pudo crear la categoría.');

      console.error('Error creando categoría:', error.message);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
