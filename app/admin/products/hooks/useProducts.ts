import { useState, useCallback, useRef } from 'react';
import { Database } from '../../../../types/database_generated';

type Product = Database['public']['Tables']['catalog_products']['Row'] & {
  imageSignedUrl?: string | null;
  categories?: { name: string } | null;
  measurement_units?: { abbreviation: string } | null;
};

/** Lo que decide qué página del catálogo se pide al servidor. */
export interface CatalogQuery {
  page: number;
  pageSize: number;
  /** Ya normalizado con `normalizeText`: minúscula y sin tildes. */
  search: string;
  /** La categoría elegida y todas sus descendientes. */
  categoryIds: string[];
  /** Un id de grupo, `__public__`, o vacío para todas. */
  group: string;
  sort: string | null;
  dir: 'asc' | 'desc';
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
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

  const fetchProducts = useCallback(async (query: CatalogQuery) => {
    const miTurno = ++peticionRef.current;

    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(query.page),
        pageSize: String(query.pageSize),
      });
      if (query.search) params.set('search', query.search);
      if (query.categoryIds.length > 0) params.set('category_ids', query.categoryIds.join(','));
      if (query.group) params.set('group', query.group);
      if (query.sort) {
        params.set('sort', query.sort);
        params.set('dir', query.dir);
      }

      const response = await fetch(`/api/products?${params}`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);
      if (miTurno !== peticionRef.current) return;

      setProducts(result.data || []);
      setTotal(result.count ?? 0);
      // Se limpia al salir bien: antes un error quedaba en pantalla para siempre,
      // aunque la siguiente carga funcionara.
      setError(null);
    } catch (err: unknown) {
      if (miTurno !== peticionRef.current) return;
      const msg = err instanceof Error ? err.message : 'Error fetching products';
      setError(msg);
    } finally {
      if (miTurno === peticionRef.current) setLoading(false);
    }
  }, []);

  const saveProduct = async (id: string | null, data: Record<string, unknown>) => {
    try {
      const url = id ? `/api/products/${id}` : '/api/products';
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving product';
      throw new Error(msg);
    }
  };

  const deleteProduct = async (id: string) => {
    const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error);
  };

  return {
    products,
    total,
    loading,
    error,
    fetchProducts,
    saveProduct,
    deleteProduct,
  };
}
