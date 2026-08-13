import { useState, useEffect } from 'react';
import { Database } from '@/types/database_generated';

export type StoreProduct = Database['public']['Tables']['store_products']['Row'] & {
  catalog_products?: { name: string; image_url: string | null; categories?: { name: string } | null } | null;
  stores?: { name: string; slug: string; marketplaces?: { name: string } | null } | null;
  measurement_units?: { abbreviation: string } | null;
  imageSignedUrl?: string | null;
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

export function usePublicProducts(storeId?: string, options: Options = {}) {
  const { enabled = true } = options;

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      return;
    }

    // Si `storeId` cambia mientras hay una petición en curso, la respuesta vieja
    // se descarta en vez de sobrescribir la nueva.
    let cancelled = false;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const url = storeId ? `/api/store-products?store_id=${storeId}` : '/api/store-products';
        const res = await fetch(url);
        const data = await res.json();

        if (cancelled) return;
        if (!res.ok) throw new Error(data.error);

        if (data.data) {
          setProducts(data.data.filter((p: StoreProduct) => p.is_active));
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Error fetching products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [storeId, enabled]);

  return { products, loading, error };
}
