import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { Database } from '../../../types/database_generated';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '../../../lib/supabase/supabase-image';
import {
  PRODUCT_CODE_UNIQUE_INDEX,
  duplicateProductCodeMessage,
  normalizeProductCode,
  validateProductCode,
} from '@/lib/products/product-code';
import { canManageStore } from '@/lib/auth/can-manage-store';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { embeddedCount } from '@/lib/db/embedded-count';
import { EXCLUSIVE_PRODUCT_MESSAGE, findExclusivityViolations } from '@/lib/catalog/visibility';

type StoreProductInsert = Database['public']['Tables']['store_products']['Insert'];

const MAX_FEATURED_PER_STORE = 5;
const MAX_FEATURED_MESSAGE = `Ya tienes ${MAX_FEATURED_PER_STORE} productos destacados. Quita uno para destacar otro.`;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get('store_id');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Esta ruta sirve TRES usos distintos, no dos, y confundir dos de ellos es lo
   * que tenía el `select('*')` abierto:
   *
   * - **Gestión**: el panel de una tienda sobre sus propios productos. Necesita
   *   también los inactivos y su precio mayorista.
   * - **Catálogo**: /admin/catalog, que consulta SIN `store_id` y necesita las
   *   mismas columnas completas. Acá se confundía con la vitrina.
   * - **Vitrina**: compradores y visitantes. Solo lo publicado y solo las
   *   columnas que pinta la tarjeta.
   *
   * Antes solo se distinguía "gestión" de "todo lo demás", y lo único que se
   * reservaba era el conteo de pedidos: a cualquiera sin sesión le llegaban
   * `wholesale_price`, `stock` y `code` de todos los productos.
   */
  const esGestion = !!storeId && !!user && (await canManageStore(supabase, storeId, user.id));

  let esCatalogo = false;
  if (!esGestion && user) {
    // El mismo módulo que protege /admin/catalog (admin, superadmin y
    // b2chat_integration).
    const { data: puedeVerCatalogo } = await supabase.rpc('has_permission', {
      module_key: 'catalog',
      action_name: 'read',
    });
    esCatalogo = puedeVerCatalogo === true;
  }

  return esGestion || esCatalogo
    ? responderGestion(supabase, searchParams, storeId, esGestion)
    : responderVitrina(supabase, searchParams, storeId);
}

/** Lo que se ordena en la vitrina, y con qué columna de la vista. */
const ORDEN_VITRINA: Record<string, string> = {
  name: 'product_name',
  price: 'price_per_unit',
};

/**
 * La vitrina pública, contra `vitrina_productos`.
 *
 * Es una vista y no la tabla con embebidos porque paginar exige ordenar contra
 * el servidor, y el nombre del producto vive en `catalog_products`: PostgREST no
 * ordena el nivel superior por una columna embebida. Aplanado, `product_name` es
 * una columna más.
 */
async function responderVitrina(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: URLSearchParams,
  storeId: string | null
) {
  const page = Number(params.get('page')) || 0;
  const paginado = page > 0;

  const construirConsulta = (from: number, to: number) => {
    let query = supabase
      .from('vitrina_productos')
      .select(
        // `product_search_text` se queda fuera a propósito: sirve para filtrar,
        // no para mostrar.
        `
          id, store_id, price_per_unit, stock, is_featured, featured_at,
          product_name, product_image_url, category_name,
          store_name, store_slug, marketplace_name, unit_abbreviation
        `,
        paginado ? { count: 'exact' } : undefined
      )
      .range(from, to);

    if (storeId) query = query.eq('store_id', storeId);

    /**
     * Un producto concreto, el de un enlace compartido (`?product=<id>`).
     *
     * La página de la tienda lo pide aparte y lo muestra arriba, resaltado.
     * Antes saltaba a la página donde caía el producto, contando su posición en
     * la lista completa; paginando contra el servidor esa lista ya no está en el
     * navegador, y calcular la posición exigiría rehacer en SQL el orden de tres
     * claves. Mostrarlo primero llega al mismo sitio y funciona con cualquier
     * filtro puesto.
     */
    const productId = params.get('product_id');
    if (productId) query = query.eq('id', productId);

    const search = (params.get('search') || '').trim();
    // El término llega ya normalizado (minúscula, sin tildes) y `search_text`
    // guarda el nombre igual, así que "platano" encuentra "plátano".
    if (search) query = query.ilike('product_search_text', `%${search}%`);

    const category = params.get('category');
    if (category) query = query.eq('category_name', category);

    const minPrice = params.get('min_price');
    if (minPrice) query = query.gte('price_per_unit', Number(minPrice));

    const maxPrice = params.get('max_price');
    if (maxPrice) query = query.lte('price_per_unit', Number(maxPrice));

    /**
     * Los destacados primero, y el orden elegido DENTRO de cada grupo: es lo que
     * hacía la página en el navegador (ordenaba destacados y resto por separado)
     * y hay que conservarlo, o paginar rompería el agrupamiento.
     *
     * `featured_at` va después del orden pedido, no antes: puesto antes mandaría
     * él —cada destacado tiene su propia fecha— y el orden elegido no se notaría.
     */
    query = query.order('is_featured', { ascending: false });

    const sort = params.get('sort');
    const columna = sort ? ORDEN_VITRINA[sort] : null;
    if (columna) query = query.order(columna, { ascending: params.get('dir') !== 'desc' });

    query = query.order('featured_at', { ascending: false });

    // Siempre al final: sin un orden total, dos filas empatadas pueden salir en
    // dos páginas o en ninguna.
    return query.order('id');
  };

  let filas: any[];
  let count: number | null = null;

  if (paginado) {
    const pageSize = Math.min(Math.max(Number(params.get('pageSize')) || 20, 1), 200);
    const from = (page - 1) * pageSize;
    const { data, count: total, error } = await construirConsulta(from, from + pageSize - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    filas = data ?? [];
    count = total ?? 0;
  } else {
    // Sin paginar hay que recorrerla entera: PostgREST corta en 1.000 filas sin
    // avisar y hay 3.746 productos publicados. Eso llevaba tiempo escondiéndole
    // 2.746 productos al comprador.
    try {
      filas = await fetchAllRows<any>((from, to) => construirConsulta(from, to));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error consultando el catálogo';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Se devuelve con la misma forma anidada que ya consumen las páginas, para que
  // aplanar la consulta no obligue a tocar `ProductCard` ni los dos listados.
  const data = filas.map((p) => ({
    id: p.id,
    store_id: p.store_id,
    price_per_unit: p.price_per_unit,
    stock: p.stock,
    is_featured: p.is_featured,
    featured_at: p.featured_at,
    imageSignedUrl: p.product_image_url
      ? getSupabaseImageUrl('products', p.product_image_url, PRESET_PRODUCT_CARD)
      : null,
    catalog_products: {
      name: p.product_name,
      image_url: p.product_image_url,
      categories: p.category_name ? { name: p.category_name } : null,
    },
    stores: {
      name: p.store_name,
      slug: p.store_slug,
      marketplaces: p.marketplace_name ? { name: p.marketplace_name } : null,
    },
    measurement_units: p.unit_abbreviation ? { abbreviation: p.unit_abbreviation } : null,
  }));

  return NextResponse.json(paginado ? { data, count } : { data }, { status: 200 });
}

/**
 * Gestión y catálogo: las columnas completas.
 *
 * `esGestion` solo decide si viaja además el conteo de pedidos. `order_items` es
 * la ÚNICA clave foránea que impide borrar un producto —carritos, movimientos de
 * stock y ofertas van en cascada y se destruyen sin avisar—, así que con ese
 * número la pantalla puede decirle al tendero qué va a pasar ANTES de que haga
 * clic. A quien solo mira el catálogo no le incumbe.
 */
async function responderGestion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: URLSearchParams,
  storeId: string | null,
  esGestion: boolean
) {
  const search = (params.get('search') || '').trim();
  // Tope opcional, para el desplegable de ofertas: sin él se devuelve todo, como
  // siempre.
  const limit = Math.min(Math.max(Number(params.get('limit')) || 0, 0), 500);

  const construirConsulta = (from: number, to: number) => {
    // Los dos `select` van escritos enteros y no armados con una plantilla
    // porque supabase-js analiza la consulta en tiempo de compilación: con un
    // trozo interpolado pierde los tipos de todo el resultado.
    //
    // `catalog_products!inner` para poder filtrar por su `search_text`. No
    // cambia ningún resultado: `catalog_product_id` es NOT NULL y no hay
    // huérfanos.
    let query = esGestion
      ? supabase.from('store_products').select(`
          *,
          catalog_products!inner ( name, image_url, description, category_id, categories ( id, name, parent_id ) ),
          stores!inner ( name, slug, is_active, marketplaces ( name ) ),
          measurement_units ( abbreviation ),
          order_items ( count )
        `)
      : supabase.from('store_products').select(`
          *,
          catalog_products!inner ( name, image_url, description, category_id, categories ( id, name, parent_id ) ),
          stores!inner ( name, slug, is_active, marketplaces ( name ) ),
          measurement_units ( abbreviation )
        `);

    if (storeId) query = query.eq('store_id', storeId);
    if (search) query = query.ilike('catalog_products.search_text', `%${search}%`);

    return query
      .order('is_featured', { ascending: false })
      .order('featured_at', { ascending: false })
      .range(from, to);
  };

  let data: any[];

  if (limit > 0) {
    const { data: filas, error } = await construirConsulta(0, limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    data = filas ?? [];
  } else {
    // Sin esto se perdían filas en silencio: la tienda más grande tiene 2.233
    // productos y solo llegaban 1.000.
    try {
      data = await fetchAllRows<any>((from, to) => construirConsulta(from, to));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error consultando los productos';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // categories se auto-referencia vía parent_id; PostgREST no resuelve un
  // embed de "categories" dentro de sí misma en este anidamiento, así que
  // el nombre del padre se resuelve acá con un mapa simple en vez de un
  // segundo nivel de embed.
  const parentIds = Array.from(
    new Set(
      data
        .map((p) => p.catalog_products?.categories?.parent_id)
        .filter((id): id is string => !!id)
    )
  );

  let parentNameById = new Map<string, string>();
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', parentIds);
    parentNameById = new Map((parents || []).map((c) => [c.id, c.name]));
  }

  // Generar URLs con transformación de Supabase (síncrono, cacheable)
  const productsWithSignedUrls = data.map((product) => {
    const imageSignedUrl = product.catalog_products?.image_url
      ? getSupabaseImageUrl('products', product.catalog_products.image_url, PRESET_PRODUCT_CARD)
      : null;
    const category = product.catalog_products?.categories;
    const categoryWithParent = category
      ? { ...category, parent: category.parent_id ? { name: parentNameById.get(category.parent_id) || '' } : null }
      : category;
    const { order_items, ...rest } = product as any;
    return {
      ...rest,
      imageSignedUrl,
      ...(esGestion ? { order_count: embeddedCount(order_items) } : {}),
      catalog_products: product.catalog_products
        ? { ...product.catalog_products, categories: categoryWithParent }
        : product.catalog_products,
    };
  });

  return NextResponse.json({ data: productsWithSignedUrls }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Asignación masiva del admin (Catálogo -> "Asignar Producto a Tienda"):
    // un producto del catálogo a varias tiendas de una. Acá no se exige `code`
    // a propósito, porque el admin no puede conocer el código interno de cada
    // tienda; esos productos quedan sin código y el vendedor lo completa al
    // editarlos, igual que los publicados antes de existir la columna.
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ error: 'No se recibió ningún producto.' }, { status: 400 });
      }

      const storeIds = Array.from(new Set(body.map((item: any) => item.store_id).filter(Boolean)));
      if (storeIds.length !== new Set(body.map((item: any) => item.store_id)).size) {
        return NextResponse.json({ error: 'Falta el store_id en algún producto.' }, { status: 400 });
      }

      const allowed = await Promise.all(
        storeIds.map((storeId) => canManageStore(supabase, storeId as string, user.id))
      );
      if (allowed.some((ok) => !ok)) {
        return NextResponse.json(
          { error: 'No tienes permisos sobre alguna de las tiendas.' },
          { status: 403 }
        );
      }

      const violations = await findExclusivityViolations(
        supabase,
        body.map((item: any) => ({
          storeId: item.store_id,
          catalogProductId: item.catalog_product_id,
        }))
      );
      if (violations.length > 0) {
        return NextResponse.json(
          {
            error:
              violations.length === body.length
                ? EXCLUSIVE_PRODUCT_MESSAGE
                : `${violations.length} de las tiendas seleccionadas no pueden publicar este producto porque es exclusivo de otro grupo.`,
          },
          { status: 403 }
        );
      }

      const inserts = body.map((item: any) => ({
        catalog_product_id: item.catalog_product_id,
        store_id: item.store_id,
        unit_id: item.unit_id,
        price_per_unit: Number(item.price_per_unit || 0),
        stock: Number(item.stock || 0),
        min_order_qty: Number(item.min_order_qty || 1),
        wholesale_price: item.wholesale_price ? Number(item.wholesale_price) : null,
        wholesale_min_qty: item.wholesale_min_qty ? Number(item.wholesale_min_qty) : null,
        is_active: item.is_active ?? true,
      }));

      const { data, error } = await supabase.from('store_products').insert(inserts).select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ data }, { status: 201 });
    }
    
    if (!body.store_id || !body.catalog_product_id) {
      return NextResponse.json(
        { error: 'Faltan store_id o catalog_product_id.' },
        { status: 400 }
      );
    }

    // Esta ruta solo comprobaba que hubiera sesión. Como store_products no tiene
    // RLS, eso permitía publicar en cualquier tienda con solo pasar su store_id,
    // y por ahí se evadía también la exclusividad del catálogo.
    if (!(await canManageStore(supabase, body.store_id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre esta tienda.' }, { status: 403 });
    }

    const violations = await findExclusivityViolations(supabase, [
      { storeId: body.store_id, catalogProductId: body.catalog_product_id },
    ]);
    if (violations.length > 0) {
      return NextResponse.json({ error: EXCLUSIVE_PRODUCT_MESSAGE }, { status: 403 });
    }

    const codeError = validateProductCode(body.code);
    if (codeError) {
      return NextResponse.json({ error: codeError }, { status: 400 });
    }

    const isFeatured = body.is_featured === true;

    if (isFeatured) {
      const { count, error: countError } = await supabase
        .from('store_products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', body.store_id)
        .eq('is_featured', true);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 400 });
      }

      if ((count ?? 0) >= MAX_FEATURED_PER_STORE) {
        return NextResponse.json({ error: MAX_FEATURED_MESSAGE }, { status: 400 });
      }
    }

    const insertData: StoreProductInsert = {
      catalog_product_id: body.catalog_product_id,
      store_id: body.store_id,
      unit_id: body.unit_id,
      price_per_unit: Number(body.price_per_unit),
      stock: Number(body.stock || 0),
      min_order_qty: Number(body.min_order_qty || 1),
      wholesale_price: body.wholesale_price ? Number(body.wholesale_price) : null,
      wholesale_min_qty: body.wholesale_min_qty ? Number(body.wholesale_min_qty) : null,
      is_active: body.is_active ?? true,
      is_featured: isFeatured,
      featured_at: isFeatured ? new Date().toISOString() : null,
      code: normalizeProductCode(body.code),
    };

    const { data, error } = await supabase.from('store_products').insert(insertData).select().single();

    if (error) {
      if (error.code === '23505' && error.message.includes(PRODUCT_CODE_UNIQUE_INDEX)) {
        return NextResponse.json({ error: duplicateProductCodeMessage(body.code) }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
