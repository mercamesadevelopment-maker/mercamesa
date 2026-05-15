import { useState, useEffect } from 'react';
import { Database } from '@/types/database_generated';

type Marketplace = Database['public']['Tables']['marketplaces']['Row'] & {
  coverSignedUrl?: string | null;
  logoSignedUrl?: string | null;
};

export function usePublicMarketplaces() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlazas = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/marketplaces');
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);

        if (data.data) {
          // Filter only active ones
          setMarketplaces(data.data.filter((p: Marketplace) => p.is_active));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error fetching marketplaces');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlazas();
  }, []);

  return { marketplaces, loading, error };
}
