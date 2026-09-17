import { useState, useCallback, useEffect } from 'react';
import { CategoryRow, CategoryInsert, CategoryUpdate } from '../types/settings.types';
import { getCategoriesService, saveCategoryService, deleteCategoryService } from '../services/settings.service';

export function useCategories() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategoriesService();
      setCategories(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const saveCategory = async (id: string | null, payload: CategoryInsert | CategoryUpdate) => {
    try {
      await saveCategoryService(id, payload);
      await fetchCategories();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar categoría');
    }
  };

  /**
   * Borra y relanza el error para que lo muestre el componente.
   *
   * Antes preguntaba con `confirm()` y avisaba con `alert()`, los cuadros grises
   * del navegador. No se podía usar `ConfirmModal` desde acá porque un hook no
   * renderiza JSX: la confirmación es de la vista, así que vive en la pestaña.
   */
  const deleteCategory = async (id: string) => {
    try {
      await deleteCategoryService(id);
      await fetchCategories();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al eliminar categoría');
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
