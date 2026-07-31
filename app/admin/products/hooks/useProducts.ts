import { useState, useCallback } from 'react';
import { Database } from '../../../../types/database_generated';

type Product = Database['public']['Tables']['catalog_products']['Row'] & {
  imageSignedUrl?: string | null;
  categories?: { name: string } | null;
  measurement_units?: { abbreviation: string } | null;
};

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      setProducts(result.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching products';
      setError(msg);
    } finally {
      setLoading(false);
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

      await fetchProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving product';
      throw new Error(msg);
    }
  };

  const deleteProduct = async (id: string) => {
    const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error);

    await fetchProducts();
  };

  return {
    products,
    loading,
    error,
    fetchProducts,
    saveProduct,
    deleteProduct,
  };
}
