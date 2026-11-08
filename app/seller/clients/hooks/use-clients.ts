import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSellerStore } from '@/app/seller/hooks/use-seller-store';
import type { ClientWithMetrics } from '@/lib/stores/store-clients';
import { fetchStoreClientsService } from '../services/clients.service';

export type { ClientOrder, ClientWithMetrics } from '@/lib/stores/store-clients';

/** Valor del selector para ver los clientes de todas las tiendas juntas. */
export const ALL_STORES = 'all';

export function useClients() {
  const { stores, storeId } = useSellerStore();
  // Es propio de esta pantalla: «todas» no es una tienda que puedan usar las
  // demás pantallas del tendero, así que no se guarda como tienda activa.
  const [scope, setScope] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithMetrics | null>(null);

  useEffect(() => {
    if (scope || !storeId) return;
    setScope(stores.length > 1 ? ALL_STORES : storeId);
  }, [scope, storeId, stores.length]);

  const fetchClients = useCallback(async () => {
    if (!scope) return;
    try {
      setLoading(true);
      setError(null);
      setClients(await fetchStoreClientsService(scope));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Filtrar clientes según búsqueda reactiva
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        c.document_number.includes(term) ||
        (c.phone && c.phone.includes(term))
    );
  }, [clients, searchTerm]);

  // Estadísticas globales del módulo
  const stats = useMemo(() => {
    const activeClients = clients.filter((c) => c.totalOrders > 0);
    const totalSpentInStore = activeClients.reduce((sum, c) => sum + c.totalSpent, 0);
    return {
      totalClients: clients.length,
      activeClientsCount: activeClients.length,
      totalSpentInStore,
    };
  }, [clients]);

  return {
    clients: filteredClients,
    loading: loading || !scope,
    error,
    searchTerm,
    setSearchTerm,
    selectedClient,
    setSelectedClient,
    stats,
    stores,
    scope,
    isAllStores: scope === ALL_STORES,
    selectScope: setScope,
    refetch: fetchClients,
  };
}
