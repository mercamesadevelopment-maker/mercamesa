import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_THUMBNAIL } from '../../../lib/supabase/supabase-image';
import { uploadVariants } from '../../../lib/images/generate';
import { PRODUCT_IMAGE_VARIANTS } from '../../../lib/images/variants';
import { generateSiigoCode } from '../../../lib/siigo';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { requirePermission } from '@/lib/auth/require-permission';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { applyCatalogVisibility, getStoreGroupId } from '@/lib/catalog/visibility';

type ProductInsert = Database['public']['Tables']['catalog_products']['Insert'];

export async function GET(request: Request) {
  const supabase = await createClient();

  // Con `store_id` la respuesta se limita a lo que esa tienda puede publicar
  // (catálogo público + lo exclusivo de su grupo); sin él devuelve el catálogo
  // completo, que es lo que necesita el admin.
  const storeId = new URL(request.url).searchParams.get('store_id');
  let storeGroupId: string | null = null;

  if (storeId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await canManageStore(supabase, storeId, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }
    try {
      storeGroupId = await getStoreGroupId(supabase, storeId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error resolviendo la tienda';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  /**
   * Paginación OPCIONAL, y por eso no cambia nada si no se pide.
   *
   * El listado del admin traía las 3.588 filas de una vez —2,78 MB— y filtraba
   * en el navegador. Con `page` pasa a pedir de a una página, y el filtro, la
   * búsqueda y el orden suben con ella: paginar sin subirlos haría que buscar
   * solo buscara dentro de la página actual.
   *
   * Sin `page` la respuesta es la de siempre, porque hay tres pantallas más que
   * dependen del catálogo completo: los dos modales de /admin/catalog y el
   * listado del tendero.
   */
  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page')) || 0;
  const paginado = page > 0;

  const construirConsulta = (from: number, to: number) => {
    let query = supabase
      .from('catalog_products')
      .select(
        // Las columnas van una a una en vez de `*` solo para dejar fuera
        // `search_text`, que es un derivado interno para buscar sin tildes y no
        // le sirve a nadie en el cliente. El resto es exactamente lo que `*`
        // devolvía antes.
        `
          id, category_id, default_unit_id, name, slug, description, image_url, is_ancestral_food, is_medicinal_plant, is_non_food, is_active, created_by, created_at, updated_at, dane_unit_code, dane_unit_name, siigo_id, owner_group_id, siigo_synced_at,
          categories ( name ),
          measurement_units ( abbreviation )
        `,
        // El total sirve para las flechas del listado: es el número de filas que
        // pasan el filtro, no las de esta página.
        paginado ? { count: 'exact' } : undefined
      )
      .range(from, to);

    if (storeId) query = applyCatalogVisibility(query, storeGroupId) as typeof query;

    if (paginado) {
      // El término llega ya en minúscula y sin tildes desde `normalizeText`;
      // `search_text` guarda el nombre y la descripción igual.
      const search = (params.get('search') || '').trim();
      if (search) query = query.ilike('search_text', `%${search}%`);

      const categoryIds = (params.get('category_ids') || '').split(',').filter(Boolean);
      if (categoryIds.length > 0) query = query.in('category_id', categoryIds);

      const group = params.get('group');
      if (group === '__public__') query = query.is('owner_group_id', null);
      else if (group) query = query.eq('owner_group_id', group);

      // Lista cerrada: un `sort` que venga de fuera no puede nombrar cualquier
      // columna. `category` y `default_unit` no están porque viven en tablas
      // embebidas y ordenar por ellas nunca funcionó en esta pantalla.
      const ORDENABLES = ['name', 'is_active', 'owner_group_id'] as const;
      const sort = params.get('sort') as (typeof ORDENABLES)[number] | null;
      if (sort && ORDENABLES.includes(sort)) {
        query = query.order(sort, { ascending: params.get('dir') !== 'desc' });
      }
    }

    // Siempre al final: desempata para que la paginación sea estable. Sin un
    // orden total, dos filas con el mismo nombre pueden salir en las dos páginas
    // o en ninguna. Va DESPUÉS del orden pedido —si fuera antes, mandaría `id` y
    // el orden elegido no se notaría—.
    return query.order('id');
  };

  let data: any[];
  let count: number | null = null;

  if (paginado) {
    const pageSize = Math.min(Math.max(Number(params.get('pageSize')) || 20, 1), 200);
    const from = (page - 1) * pageSize;
    const { data: filas, count: total, error } = await construirConsulta(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    data = filas ?? [];
    count = total ?? 0;
  } else {
    // Sin paginar hay que recorrerlo entero: PostgREST corta en 1.000 filas sin
    // avisar, y el catálogo ya pasa de 3.500. Sin esto se ocultarían productos
    // en silencio.
    try {
      data = await fetchAllRows<any>((from, to) => construirConsulta(from, to));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error consultando el catálogo';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Generar URLs con transformación de Supabase (cacheable, sin llamadas de red adicionales)
  const productsWithPublicUrls = data.map((product) => {
    const imageSignedUrl = product.image_url
      ? getSupabaseImageUrl('products', product.image_url, PRESET_THUMBNAIL)
      : null;
    return { ...product, imageSignedUrl };
  });

  return NextResponse.json(
    paginado ? { data: productsWithPublicUrls, count } : { data: productsWithPublicUrls },
    { status: 200 }
  );
}


export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // catalog_products no tiene RLS: sin esta verificación bastaba con estar
    // autenticado —aunque fuera como comprador— para escribir en el catálogo.
    const denied = await requirePermission(
      supabase,
      'master-catalog',
      'create',
      'No tienes permisos para crear productos del catálogo'
    );
    if (denied) return denied;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const productId = (body.id as string) || crypto.randomUUID();

    const name = body.name as string;
    const slug = body.slug as string;
    const category_id = (body.category_id as string) || null;
    const default_unit_id = (body.default_unit_id as string) || null;
    const description = (body.description as string) || null;
    const dane_unit_code = (body.dane_unit_code as string) || null;
    const dane_unit_name = (body.dane_unit_name as string) || null;
    // Vacío = producto público, que cualquier tienda puede publicar.
    const owner_group_id = (body.owner_group_id as string) || null;

    const is_active = body.is_active === true || body.is_active === 'true';
    const is_ancestral_food = body.is_ancestral_food === true || body.is_ancestral_food === 'true';
    const is_medicinal_plant = body.is_medicinal_plant === true || body.is_medicinal_plant === 'true';
    const is_non_food = body.is_non_food === true || body.is_non_food === 'true';

    if (!name || !slug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let image_url: string | null = null;

    // El cliente ya subió el original directo a Storage (evita el límite de
    // payload de las funciones serverless); acá solo descargamos el buffer
    // para generar los derivados con sharp.
    if (body.image_url) {
      image_url = body.image_url as string;
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('products')
        .download(image_url);
      if (downloadError) throw downloadError;
      const buffer = Buffer.from(await fileData.arrayBuffer());
      await uploadVariants(supabase, 'products', image_url, buffer, PRODUCT_IMAGE_VARIANTS);
    }

    const insertData: ProductInsert = {
      id: productId,
      name,
      slug,
      category_id: category_id || null,
      default_unit_id: default_unit_id || null,
      description,
      is_active,
      is_ancestral_food,
      is_medicinal_plant,
      is_non_food,
      image_url,
      dane_unit_code: dane_unit_code || null,
      dane_unit_name: dane_unit_name || null,
      owner_group_id,
      created_by: user.id,
      siigo_id: generateSiigoCode(productId),
    };

    const { data, error } = await supabase.from('catalog_products').insert(insertData).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
