import { useState, useCallback, useEffect } from 'react';

export interface StoreGroupStore {
  id: string;
  name: string;
  slug: string;
}

export interface StoreGroupRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  stores: StoreGroupStore[];
}

async function readError(res: Response, fallback: string): Promise<never> {
  const json = await res.json().catch(() => ({}));
  throw new Error(json.error || fallback);
}

export function useStoreGroups() {
  const [groups, setGroups] = useState<StoreGroupRow[]>([]);
  const [stores, setStores] = useState<StoreGroupStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [groupsRes, storesRes] = await Promise.all([
        fetch('/api/admin/store-groups'),
        fetch('/api/stores'),
      ]);

      if (!groupsRes.ok) await readError(groupsRes, 'Error al cargar los grupos de tiendas');
      const groupsJson = await groupsRes.json();
      setGroups(groupsJson.data ?? []);

      if (storesRes.ok) {
        const storesJson = await storesRes.json();
        setStores(
          (storesJson.data ?? []).map((store: { id: string; name: string; slug: string }) => ({
            id: store.id,
            name: store.name,
            slug: store.slug,
          }))
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los grupos de tiendas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  /** Devuelve el grupo guardado: al crear, hace falta su id para asignarle tiendas. */
  const saveGroup = async (
    id: string | null,
    payload: { name: string; description: string | null }
  ): Promise<{ id: string }> => {
    const res = await fetch(id ? `/api/admin/store-groups/${id}` : '/api/admin/store-groups', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) await readError(res, 'Error al guardar el grupo');
    const json = await res.json();
    await fetchGroups();
    return json.data;
  };

  /** Se envía la lista completa de tiendas del grupo; el servidor calcula altas y bajas. */
  const setGroupStores = async (id: string, storeIds: string[]) => {
    const res = await fetch(`/api/admin/store-groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_ids: storeIds }),
    });
    if (!res.ok) await readError(res, 'Error al actualizar las tiendas del grupo');
    await fetchGroups();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('¿Eliminar este grupo de tiendas?')) return;

    let res = await fetch(`/api/admin/store-groups/${id}`, { method: 'DELETE' });

    // El servidor devuelve 409 cuando el grupo tiene productos exclusivos:
    // borrarlo los vuelve públicos, así que esa consecuencia se confirma aparte.
    if (res.status === 409) {
      const json = await res.json().catch(() => ({}));
      if (!confirm(`${json.error}\n\n¿Eliminar el grupo de todas formas?`)) return;
      res = await fetch(`/api/admin/store-groups/${id}?confirm=true`, { method: 'DELETE' });
    }

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || 'Error al eliminar el grupo');
      return;
    }

    await fetchGroups();
  };

  return { groups, stores, loading, error, fetchGroups, saveGroup, setGroupStores, deleteGroup };
}
