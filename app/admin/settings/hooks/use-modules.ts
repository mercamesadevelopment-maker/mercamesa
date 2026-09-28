import { useState, useCallback, useEffect } from 'react';
import { ModuleRow, ModuleUpdate, RoleOption } from '../types/settings.types';
import {
  getModulesService,
  updateModuleService,
  saveModuleReadRolesService,
} from '../services/settings.service';

/**
 * Los módulos se crean y se borran por código (migraciones); aquí solo se edita
 * lo visible y quién puede verlos.
 */
export function useModules() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { modules, roles } = await getModulesService();
      setModules(modules);
      setRoles(roles);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar módulos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  /**
   * Guarda los datos del módulo y, si cambiaron, quién lo ve. Relanza el error
   * para que el modal lo muestre.
   */
  const saveModule = async (id: string, payload: ModuleUpdate, readRoleIds: string[] | null) => {
    try {
      await updateModuleService(id, payload);
      if (readRoleIds) await saveModuleReadRolesService(id, readRoleIds);
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar módulo');
    } finally {
      // Aunque falle la segunda parte, la primera pudo quedar guardada: se
      // recarga para no mostrar un estado que ya no es el de la base.
      await fetchModules();
    }
  };

  return {
    modules,
    roles,
    loading,
    error,
    fetchModules,
    saveModule,
  };
}
