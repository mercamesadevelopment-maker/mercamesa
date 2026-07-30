import { useState, useEffect } from 'react';
import { Database } from '@/types/database_generated';

export type StoreProduct = Database['public']['Tables']['store_products']['Row'] & {
  catalog_products?: { name: string; image_url: string | null; categories?: { name: string } | null } | null;
  stores?: { name: string; slug: string; marketplaces?: { name: string } | null } | null;
  measurement_units?: { abbreviation: string } | null;
  imageSignedUrl?: string | null;
};

export function usePublicProducts(storeId?: string) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const url = storeId ? `/api/store-products?store_id=${storeId}` : '/api/store-products';
        const res = await fetch(url);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);

        if (data.data) {
          // In a real app, we would sign URLs in the backend or here. 
          // Assuming backend handles signed URLs or we don't need them for MVP, but let's assume they are provided or we use public URLs.
          // Since our /api/store-products currently doesn't sign images, we'll just filter active ones.
          // Note: for production, the API should return signed URLs like /api/offers does.
          
          setProducts(data.data.filter((p: StoreProduct) => p.is_active));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error fetching products');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProducts();
  }, [storeId]);

  return { products, loading, error };
}
