import { useState, useCallback } from 'react';
import { Database } from '../../../../types/database_generated';

type StoreProduct = Database['public']['Tables']['store_products']['Row'] & {
  catalog_products?: { 
    name: string; 
    image_url: string | null; 
    description: string | null;
    category_id: string | null;
    categories?: { name: string } | null;
  } | null;
  stores?: { name: string; marketplaces?: { name: string } | null } | null;
  measurement_units?: { abbreviation: string } | null;
};

export function useStoreProducts() {
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStoreProducts = useCallback(async (storeId?: string) => {
    try {
      setLoading(true);
      const url = storeId ? `/api/store-products?store_id=${storeId}` : '/api/store-products';
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      setStoreProducts(result.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching store products';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveStoreProduct = async (id: string | null, data: Partial<StoreProduct>) => {
    try {
      const url = id ? `/api/store-products/${id}` : '/api/store-products';
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      await fetchStoreProducts();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving store product';
      alert(msg);
      return false;
    }
  };

  const deleteStoreProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto de la tienda?')) return;
    
    try {
      const response = await fetch(`/api/store-products/${id}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      await fetchStoreProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting store product';
      alert(msg);
    }
  };

  return {
    storeProducts,
    loading,
    error,
    fetchStoreProducts,
    saveStoreProduct,
    deleteStoreProduct,
  };
}
