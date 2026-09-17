import { useState, useCallback, useEffect } from 'react';
import { ModuleRow, ModuleInsert, ModuleUpdate } from '../types/settings.types';
import { getModulesService, saveModuleService, deleteModuleService } from '../services/settings.service';

export function useModules() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getModulesService();
      setModules(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar módulos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const saveModule = async (id: string | null, payload: ModuleInsert | ModuleUpdate) => {
    try {
      await saveModuleService(id, payload);
      await fetchModules();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar módulo');
    }
  };

  /** Relanza el error: la confirmación y el aviso son de la vista, no del hook. */
  const deleteModule = async (id: string) => {
    try {
      await deleteModuleService(id);
      await fetchModules();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al eliminar módulo');
    }
  };

  return {
    modules,
    loading,
    error,
    fetchModules,
    saveModule,
    deleteModule,
  };
}
