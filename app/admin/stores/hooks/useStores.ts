import { useState, useCallback } from 'react';
import { Database } from '../../../../types/database_generated';

export type Store = Database['public']['Tables']['stores']['Row'] & {
  coverSignedUrl?: string | null;
  logoSignedUrl?: string | null;
  marketplaces?: { name: string } | null;
  profiles?: { full_name: string } | null;
  store_documents?: { id: string; document_type_id: string; status: string }[] | null;
  store_members?: {
    id: string;
    role_id: string;
    roles?: { name: string; label: string } | null;
    profiles?: { id: string; full_name: string; email: string } | null;
  }[] | null;
};

export function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [requiredDocumentTypes, setRequiredDocumentTypes] = useState<{ id: string; name: string; slug: string; is_required: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = useCallback(async (memberOnly?: boolean) => {
    try {
      setLoading(true);
      const url = memberOnly ? '/api/stores?member_only=true' : '/api/stores';
      const response = await fetch(url);
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      // Fetch signed URLs for logos if needed for the table list
      const storesData = result.data || [];
      const storesWithSignedUrls = await Promise.all(
        storesData.map(async (store: Store) => {
          if (!store.logo_url) return store;
          try {
             // For simplicity, we fetch individual details only if needed, but here we can just use the GET /api/stores/[id] to get signed urls or build a batch endpoint.
             // We'll rely on a basic placeholder or the actual DB logic handled via Next backend.
             return store;
          } catch (e) {
            return store;
          }
        })
      );

      setStores(storesWithSignedUrls);
      setRequiredDocumentTypes(result.requiredDocumentTypes || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching stores';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveStore = async (id: string | null, data: Record<string, unknown>) => {
    try {
      const url = id ? `/api/stores/${id}` : '/api/stores';
      const method = id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      await fetchStores();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving store';
      throw new Error(msg);
    }
  };

  const deleteStore = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tienda?')) return;
    
    try {
      const response = await fetch(`/api/stores/${id}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);
      
      await fetchStores();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting store';
      alert(msg);
    }
  };

  return {
    stores,
    requiredDocumentTypes,
    loading,
    error,
    fetchStores,
    saveStore,
    deleteStore,
  };
}
