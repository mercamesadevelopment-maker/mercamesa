'use client';

import { useCallback, useState } from 'react';
import { uploadImageDirect } from '@/lib/supabase/client-upload';
import {
  storeProfileService,
  type StoreProfile,
  type StoreCategory,
} from '../services/store-profile.service';

export function useStoreProfile(storeId: string | null) {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStore = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      setError(null);
      const [data, cats] = await Promise.all([
        storeProfileService.getStore(storeId),
        storeProfileService.getCategories(),
      ]);
      setStore(data);
      setCategories(cats || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando la tienda');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const saveStore = useCallback(
    async (
      payload: Record<string, unknown>,
      images: { logo?: File | null; cover?: File | null }
    ) => {
      if (!storeId) return false;
      try {
        setSaving(true);
        setError(null);

        // Las imágenes van directo a Storage desde el navegador para no chocar
        // con el límite de payload de las funciones serverless; al servidor solo
        // se le manda la ruta, y él genera los derivados. Misma convención que
        // el modal del admin.
        const body = { ...payload };

        if (images.logo) {
          const ext = images.logo.name.split('.').pop();
          const path = `imgs/${storeId}/logo-${Date.now()}.${ext}`;
          await uploadImageDirect('stores', path, images.logo);
          body.logo_url = path;
        }

        if (images.cover) {
          const ext = images.cover.name.split('.').pop();
          const path = `imgs/${storeId}/cover-${Date.now()}.${ext}`;
          await uploadImageDirect('stores', path, images.cover);
          body.cover_image_url = path;
        }

        await storeProfileService.updateStore(storeId, body);
        // Se relee para traer las URLs firmadas de las imágenes nuevas.
        await fetchStore();
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error guardando la tienda');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [storeId, fetchStore]
  );

  return { store, categories, loading, saving, error, fetchStore, saveStore };
}
