import { useState, useCallback } from 'react';
import { Database } from '../../../../types/database_generated';

export type StoreOffer = Database['public']['Tables']['store_offers']['Row'] & {
  imageSignedUrl?: string | null;
  store_products?: {
    id: string;
    store_id: string;
    catalog_products?: {
      name: string;
      image_url: string | null;
    } | null;
  } | null;
};

export function useOffers() {
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async (storeId?: string) => {
    try {
      setLoading(true);
      const url = storeId ? `/api/offers?store_id=${storeId}` : '/api/offers';
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      setOffers(result.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching offers';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveOffer = async (id: string | null, data: Partial<StoreOffer>) => {
    try {
      const url = id ? `/api/offers/${id}` : '/api/offers';
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      await fetchOffers();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving offer';
      alert(msg);
      return false;
    }
  };

  const deleteOffer = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta oferta?')) return;
    
    try {
      const response = await fetch(`/api/offers/${id}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      await fetchOffers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting offer';
      alert(msg);
    }
  };

  return {
    offers,
    loading,
    error,
    fetchOffers,
    saveOffer,
    deleteOffer,
  };
}
