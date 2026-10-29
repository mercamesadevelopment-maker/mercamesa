import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseImageUrl, PRESET_PRODUCT_CARD } from '@/lib/supabase/supabase-image';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { resolveOfferPrices, type PrecioResuelto } from '@/lib/offers/resolve-offer-prices';

/** Lo que se ordena en la vitrina, y con qué columna de la vista. */
const ORDEN_VITRINA: Record<string, string> = {
  name: 'product_name',
  price: 'price_per_unit',
};

/** Cuántos ids caben en un `.in(...)` sin que la URL de PostgREST se desborde. */
const TANDA_DE_OFERTAS = 200;

/** Una fila de `vitrina_productos`, con las columnas que se piden. */
export interface StorefrontRow {
  id: string;
  store_id: string;
  price_per_unit: number | null;
  stock: number | null;
  is_featured: boolean | null;
  featured_at: string | null;
  product_name: string | null;
  product_image_url: string | null;
  category_name: string | null;
  store_name: string | null;
  store_slug: string | null;
  marketplace_name: string | null;
  unit_abbreviation: string | null;
}

/**
 * La vitrina pública, contra `vitrina_productos`.
 *
 * Es una vista y no la tabla con embebidos porque paginar exige ordenar contra
 * el servidor, y el nombre del producto vive en `catalog_products`: PostgREST no
 * ordena el nivel superior por una columna embebida. Aplanado, `product_name` es
 * una columna más.
 *
 * Con `page` devuelve una página y el total; sin ella, todo. Un error de la
 * consulta se lanza con el mensaje de PostgREST.
 */
export async function listStorefront(
  supabase: SupabaseClient<any>,
  params: URLSearchParams,
  storeId: string | null
): Promise<{ data: ReturnType<typeof toStorefrontItem>[]; count: number | null; paginated: boolean }> {
  const page = Number(params.get('page')) || 0;
  const paginated = page > 0;

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
        paginated ? { count: 'exact' } : undefined
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
     * Antes que los destacados, los que tienen una oferta vigente: la oferta
     * vence y es lo que más le conviene al comprador ver primero. Se decide en
     * la base (`has_active_offer`) porque la vitrina se pagina en el servidor.
     *
     * Después, los destacados primero y el orden elegido DENTRO de cada grupo:
     * es lo que hacía la página en el navegador (ordenaba destacados y resto por
     * separado) y hay que conservarlo, o paginar rompería el agrupamiento.
     *
     * `featured_at` va después del orden pedido, no antes: puesto antes mandaría
     * él —cada destacado tiene su propia fecha— y el orden elegido no se notaría.
     */
    query = query.order('has_active_offer', { ascending: false });
    query = query.order('is_featured', { ascending: false });

    const sort = params.get('sort');
    const columna = sort ? ORDEN_VITRINA[sort] : null;
    if (columna) query = query.order(columna, { ascending: params.get('dir') !== 'desc' });

    query = query.order('featured_at', { ascending: false });

    // Siempre al final: sin un orden total, dos filas empatadas pueden salir en
    // dos páginas o en ninguna.
    return query.order('id');
  };

  let filas: StorefrontRow[];
  let count: number | null = null;

  if (paginated) {
    const pageSize = Math.min(Math.max(Number(params.get('pageSize')) || 20, 1), 200);
    const from = (page - 1) * pageSize;
    const { data, count: total, error } = await construirConsulta(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    filas = (data ?? []) as StorefrontRow[];
    count = total ?? 0;
  } else {
    // Sin paginar hay que recorrerla entera: PostgREST corta en 1.000 filas sin
    // avisar y hay 3.746 productos publicados. Eso llevaba tiempo escondiéndole
    // 2.746 productos al comprador.
    filas = await fetchAllRows<StorefrontRow>((from, to) => construirConsulta(from, to) as any);
  }

  /**
   * La oferta vigente de cada producto, con la MISMA función que usan la
   * cotización y la creación del pedido.
   *
   * La vitrina no las traía: la tarjeta mostraba el precio de lista y agregaba
   * el producto a ese precio, mientras el servidor cobraba con descuento. El
   * comprador veía el valor completo hasta recargar la página, que es cuando
   * `fetchCart` busca la oferta.
   */
  let precios: Map<string, PrecioResuelto>;
  try {
    precios = await preciosDeVitrina(supabase, filas);
  } catch (error: unknown) {
    // Sin ofertas la vitrina sigue sirviendo: se muestra el precio de lista, y
    // el descuento igual se aplica al cotizar y al cobrar.
    console.error('store-products: no se pudieron resolver las ofertas', error);
    precios = new Map();
  }

  return { data: filas.map((fila) => toStorefrontItem(fila, precios.get(fila.id))), count, paginated };
}

/**
 * Los precios resueltos de las filas de la vitrina. Paginada son a lo sumo 200;
 * sin paginar pueden ser miles, y por eso se resuelven por tandas.
 */
async function preciosDeVitrina(
  supabase: SupabaseClient<any>,
  filas: { id: string; price_per_unit: number | null }[]
): Promise<Map<string, PrecioResuelto>> {
  const precios = new Map<string, PrecioResuelto>();

  for (let i = 0; i < filas.length; i += TANDA_DE_OFERTAS) {
    const tanda = await resolveOfferPrices(supabase, filas.slice(i, i + TANDA_DE_OFERTAS) as any, false);
    tanda.forEach((precio, id) => precios.set(id, precio));
  }

  return precios;
}

/**
 * Una fila de la vista con la forma anidada que ya consumen las páginas, para
 * que aplanar la consulta no obligue a tocar `ProductCard` ni los dos listados.
 */
export function toStorefrontItem(p: StorefrontRow, precio: PrecioResuelto | undefined) {
  return {
    id: p.id,
    store_id: p.store_id,
    // Sigue siendo el precio de lista: el filtro y el orden van contra él.
    price_per_unit: p.price_per_unit,
    offer: precio?.offerId ? { id: precio.offerId, finalPrice: precio.finalPrice, label: precio.label } : null,
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
  };
}
