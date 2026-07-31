import { useState } from 'react';
import { Database } from '../../../../types/database_generated';

type Marketplace = Database['public']['Tables']['marketplaces']['Row'] & {
  coverSignedUrl?: string | null;
  logoSignedUrl?: string | null;
};

export function useMarketplaces() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketplaces = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/marketplaces');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMarketplaces(json.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const deleteMarketplace = async (id: string) => {
    if (!confirm('Are you sure you want to delete this marketplace?')) return;

    try {
      const res = await fetch(`/api/marketplaces/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error);
      }
      setMarketplaces(prev => prev.filter(m => m.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert(message);
    }
  };

  const saveMarketplace = async (data: Record<string, unknown>, id?: string) => {
    try {
      const isEditing = !!id;
      const url = isEditing ? `/api/marketplaces/${id}` : '/api/marketplaces';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (isEditing) {
        setMarketplaces(prev => prev.map(m => m.id === id ? { ...m, ...json.data } : m));
      } else {
        setMarketplaces(prev => [...prev, json.data]);
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      alert(message);
      return false;
    }
  };

  return {
    marketplaces,
    loading,
    error,
    fetchMarketplaces,
    deleteMarketplace,
    saveMarketplace
  };
}
