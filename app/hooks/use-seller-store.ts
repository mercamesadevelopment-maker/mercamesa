import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function useSellerStore() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStore = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('No authenticated user');
          setLoading(false);
          return;
        }

        const { data: member, error: memberError } = await supabase
          .from('store_members')
          .select('store_id, stores(name)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (memberError) {
          console.error('Error in store_members query:', memberError);
        }

        if (member) {
          setStoreId(member.store_id);
          setStoreName((member.stores as any)?.name || 'Mi Tienda');
        } else {
          // Fallback a la primera tienda registrada en la base de datos
          const { data: firstStore, error: firstStoreError } = await supabase
            .from('stores')
            .select('id, name')
            .limit(1)
            .maybeSingle();
            
          if (firstStore) {
            setStoreId(firstStore.id);
            setStoreName(firstStore.name);
          } else {
            setError('User is not a member of any store and no stores exist in DB.');
          }
        }
      } catch (err: any) {
        console.error('Error fetching seller store:', err);
        setError(err.message || 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchStore();
  }, []);

  return { storeId, storeName, loading, error };
}
