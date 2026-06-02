import { useState, useEffect } from 'react';
import { Database } from '../../../../types/database_generated';

export type Module = Database['public']['Tables']['modules']['Row'];

export function usePermissions(roleId?: string, hydrated?: boolean) {
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  // Empieza en true para no mostrar "Sin módulos" mientras hidrata
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si el store aún no terminó de hidratar, esperamos
    if (!hydrated) return;

    // Store hidratado pero sin rol: no hay nada que cargar
    if (!roleId) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/auth/permissions?role_id=${roleId}`);
        if (!res.ok) throw new Error('Failed to fetch permissions');
        const json = await res.json();
        setModules(json.data?.modules || []);
        setPermissions(json.data?.permissions || {});
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setModules([]);
        setPermissions({});
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [roleId, hydrated]);

  const hasPermission = (moduleKey: string, actionName: string) => {
    return permissions[moduleKey]?.includes(actionName) ?? false;
  };

  return { modules, permissions, hasPermission, loading };
}