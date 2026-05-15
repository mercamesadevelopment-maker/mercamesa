import { useState, useEffect } from 'react';
import { Database } from '@/types/database_generated';

type Store = Database['public']['Tables']['stores']['Row'] & {
  logoSignedUrl?: string | null;
  marketplaces?: { name: string } | null;
};

export function usePublicStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/stores');
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);

        if (data.data) {
          // Filter only active ones
          setStores(data.data.filter((s: Store) => s.is_active));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error fetching stores');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStores();
  }, []);

  return { stores, loading, error };
}
