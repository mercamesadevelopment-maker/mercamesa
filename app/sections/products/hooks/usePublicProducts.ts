import { useCallback, useEffect, useRef, useState } from 'react';
import { Database } from '@/types/database_generated';

export type StoreProduct = Database['public']['Tables']['store_products']['Row'] & {
  catalog_products?: { name: string; image_url: string | null; categories?: { name: string } | null } | null;
  stores?: { name: string; slug: string; marketplaces?: { name: string } | null } | null;
  measurement_units?: { abbreviation: string } | null;
  imageSignedUrl?: string | null;
  /**
   * La oferta vigente, ya resuelta por el servidor con la misma regla con la que
   * cobra. `price_per_unit` sigue siendo el precio de lista.
   */
  offer?: { id: string; finalPrice: number; label: string | null } | null;
};

/** Qué página de la vitrina se le pide al servidor. */
export interface VitrinaQuery {
  page: number;
  pageSize: number;
  /** Ya normalizado con `normalizeText`: minúscula y sin tildes. */
  search: string;
  /** Nombre de la categoría, o vacío para todas. */
  category: string;
  minPrice: number | '';
  maxPrice: number | '';
  sort: 'name' | 'price' | null;
  dir: 'asc' | 'desc';
  /** Un solo producto, el de un enlace compartido. Ignora el resto de filtros. */
  productId?: string;
}

export const CONSULTA_INICIAL: VitrinaQuery = {
  page: 1,
  pageSize: 20,
  search: '',
  category: '',
  minPrice: '',
  maxPrice: '',
  sort: null,
  dir: 'asc',
};

interface Options {
  /**
   * `false` mientras todavía no se sabe qué tienda es. Sin esto, la página de
   * una tienda arrancaba con `storeId` indefinido y pedía el catálogo COMPLETO
   * del marketplace; esa respuesta —la más pesada— llegaba después de la ya
   * filtrada y la pisaba, dejando en pantalla los productos de todas las
   * tiendas, incluidos los exclusivos de otro grupo con sus fotos.
   */
  enabled?: boolean;
}

/**
 * La vitrina, pedida por páginas al servidor.
 *
 * Antes se traía entera y se filtraba, ordenaba y paginaba en el navegador. Con
 * 3.746 productos publicados eso eran ~4,3 MB por visita y, peor, PostgREST
 * corta en 1.000 filas sin avisar: el catálogo llevaba tiempo escondiendo 2.746
 * productos, y la tienda más grande —2.233 productos— mostraba menos de la mitad
 * de su inventario.
 *
 * La búsqueda, el filtro y el orden suben con la paginación a propósito: paginar
 * sin subirlos haría que buscar solo buscara dentro de la página actual, que es
 * peor que el problema original.
 */
export function usePublicProducts(storeId?: string, options: Options = {}) {
  const { enabled = true } = options;

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Descarta las respuestas viejas.
   *
   * Al escribir en el buscador salen varias peticiones y no vuelven en orden:
   * sin esto, una respuesta lenta de hace tres teclas puede pisar a la buena.
   */
  const peticionRef = useRef(0);

  const fetchProducts = useCallback(
    async (query: VitrinaQuery) => {
      if (!enabled) return;

      const miTurno = ++peticionRef.current;

      try {
        setLoading(true);

        const params = new URLSearchParams({
          page: String(query.page),
          pageSize: String(query.pageSize),
        });
        if (storeId) params.set('store_id', storeId);
        if (query.search) params.set('search', query.search);
        if (query.category) params.set('category', query.category);
        if (query.minPrice !== '') params.set('min_price', String(query.minPrice));
        if (query.maxPrice !== '') params.set('max_price', String(query.maxPrice));
        if (query.sort) {
          params.set('sort', query.sort);
          params.set('dir', query.dir);
        }
        if (query.productId) params.set('product_id', query.productId);

        const res = await fetch(`/api/store-products?${params}`);
        const data = await res.json();

        if (miTurno !== peticionRef.current) return;
        if (!res.ok) throw new Error(data.error);

        setProducts(data.data ?? []);
        setTotal(data.count ?? 0);
        setError(null);
      } catch (e: unknown) {
        if (miTurno !== peticionRef.current) return;
        setError(e instanceof Error ? e.message : 'Error fetching products');
      } finally {
        if (miTurno === peticionRef.current) setLoading(false);
      }
    },
    [storeId, enabled]
  );

  return { products, total, loading, error, fetchProducts };
}

/**
 * Un producto suelto por su id, para el enlace compartido.
 *
 * Va aparte del listado a propósito: no debe pisar la página que la persona esté
 * viendo ni contar para el total.
 */
export async function fetchProductoCompartido(
  productId: string,
  storeId?: string
): Promise<StoreProduct | null> {
  const params = new URLSearchParams({ page: '1', pageSize: '1', product_id: productId });
  if (storeId) params.set('store_id', storeId);

  try {
    const res = await fetch(`/api/store-products?${params}`);
    const json = await res.json();
    return json.data?.[0] ?? null;
  } catch (e) {
    console.error('No se pudo cargar el producto compartido', e);
    return null;
  }
}

/** Las categorías que de verdad tienen productos publicados, para el carrusel. */
export function useVitrinaCategorias(storeId?: string, enabled = true) {
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const params = storeId ? `?store_id=${storeId}` : '';

    fetch(`/api/store-products/categories${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setCategorias((json.data ?? []).map((c: { name: string }) => c.name));
      })
      // Sin categorías el carrusel se queda en "Todas", que sigue siendo
      // utilizable: no hay razón para tumbar la página por esto.
      .catch((e) => console.error('No se pudieron cargar las categorías', e));

    return () => {
      cancelled = true;
    };
  }, [storeId, enabled]);

  return categorias;
}
