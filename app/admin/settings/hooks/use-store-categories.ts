import { useState, useCallback, useEffect } from 'react';
import { StoreCategoryRow, StoreCategoryInsert, StoreCategoryUpdate } from '../types/settings.types';
import { getStoreCategoriesService, saveStoreCategoryService, deleteStoreCategoryService } from '../services/settings.service';

export function useStoreCategories() {
  const [categories, setCategories] = useState<StoreCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStoreCategoriesService();
      setCategories(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar categorías de tienda');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const saveCategory = async (id: string | null, payload: StoreCategoryInsert | StoreCategoryUpdate) => {
    try {
      await saveStoreCategoryService(id, payload);
      await fetchCategories();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar categoría de tienda');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría de tienda?')) return;
    try {
      await deleteStoreCategoryService(id);
      await fetchCategories();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar categoría de tienda');
    }
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    saveCategory,
    deleteCategory,
  };
}
