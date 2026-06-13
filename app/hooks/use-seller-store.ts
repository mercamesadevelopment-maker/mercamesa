import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export interface SellerStore {
  id: string;
  name: string;
}

export function useSellerStore() {
  const [stores, setStores] = useState<SellerStore[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to change active store and persist it
  const selectStore = (id: string) => {
    setStoreId(id);
    const selected = stores.find(s => s.id === id);
    if (selected) {
      setStoreName(selected.name);
    }
    localStorage.setItem('selected_seller_store_id', id);
    // Dispatch a custom event to sync with other instances in the same tab
    window.dispatchEvent(new Event('seller-store-changed'));
  };

  useEffect(() => {
    const fetchStores = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('No authenticated user');
          setLoading(false);
          return;
        }

        const { data: members, error: memberError } = await supabase
          .from('store_members')
          .select('store_id, stores(name)')
          .eq('user_id', user.id);

        if (memberError) {
          console.error('Error in store_members query:', memberError);
        }

        let finalStores: SellerStore[] = [];

        if (members && members.length > 0) {
          finalStores = members.map((m: any) => ({
            id: m.store_id,
            name: m.stores?.name || 'Mi Tienda'
          }));
        } else {
          // Fallback to the first store in DB
          const { data: firstStore, error: firstStoreError } = await supabase
            .from('stores')
            .select('id, name')
            .limit(1)
            .maybeSingle();

          if (firstStoreError) {
            console.error('Error fetching fallback store:', firstStoreError);
          }
            
          if (firstStore) {
            finalStores = [{ id: firstStore.id, name: firstStore.name }];
          } else {
            setError('User is not a member of any store and no stores exist in DB.');
          }
        }

        setStores(finalStores);

        if (finalStores.length > 0) {
          // Determine initially selected store
          const persistedId = localStorage.getItem('selected_seller_store_id');
          const exists = finalStores.some(s => s.id === persistedId);
          const initialStore = exists 
            ? finalStores.find(s => s.id === persistedId)! 
            : finalStores[0];

          setStoreId(initialStore.id);
          setStoreName(initialStore.name);
          if (!exists) {
            localStorage.setItem('selected_seller_store_id', initialStore.id);
          }
        }
      } catch (err: any) {
        console.error('Error fetching seller stores:', err);
        setError(err.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  // Sync selected store across components and tabs
  useEffect(() => {
    if (stores.length === 0) return;

    const syncStore = () => {
      const persistedId = localStorage.getItem('selected_seller_store_id');
      if (persistedId && persistedId !== storeId) {
        const selected = stores.find(s => s.id === persistedId);
        if (selected) {
          setStoreId(persistedId);
          setStoreName(selected.name);
        }
      }
    };

    window.addEventListener('seller-store-changed', syncStore);
    window.addEventListener('storage', syncStore);
    return () => {
      window.removeEventListener('seller-store-changed', syncStore);
      window.removeEventListener('storage', syncStore);
    };
  }, [stores, storeId]);

  return { stores, storeId, storeName, loading, error, selectStore };
}
