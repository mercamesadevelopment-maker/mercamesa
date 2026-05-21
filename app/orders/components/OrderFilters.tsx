import React, { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { ORDER_STATUS_LABELS, OrderStatus } from '../types/order.types';
import { cn } from '@/src/components/Shared';

interface Store {
  id: string;
  name: string;
}

interface OrderFiltersProps {
  selectedStoreId: string | null;
  onStoreChange: (id: string | null) => void;
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
  onClear: () => void;
}

export function OrderFilters({
  selectedStoreId,
  onStoreChange,
  selectedStatus,
  onStatusChange,
  onClear,
}: OrderFiltersProps) {
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    fetch('/api/stores')
      .then((res) => res.json())
      .then((result) => {
        if (result.data) setStores(result.data);
      })
      .catch((err) => console.error('Error fetching stores for filters:', err));
  }, []);

  const statuses = Object.entries(ORDER_STATUS_LABELS).map(([id, label]) => ({
    id,
    label,
  }));

  const hasFilters = selectedStoreId || selectedStatus;

  return (
    <div className="bg-white p-4 rounded-3xl border border-mm-crd shadow-sm flex flex-wrap items-center gap-4 mb-8">
      <div className="flex items-center gap-2 text-mm-txw mr-2">
        <Filter className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Filtros</span>
      </div>

      <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-4">
        <select
          value={selectedStoreId || ''}
          onChange={(e) => onStoreChange(e.target.value || null)}
          className="bg-mm-gbg/50 border-none rounded-xl px-4 py-2 text-sm text-mm-g outline-none focus:ring-2 ring-mm-g/20 transition-all cursor-pointer"
        >
          <option value="">Todas las tiendas</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus || ''}
          onChange={(e) => onStatusChange(e.target.value || null)}
          className="bg-mm-gbg/50 border-none rounded-xl px-4 py-2 text-sm text-mm-g outline-none focus:ring-2 ring-mm-g/20 transition-all cursor-pointer"
        >
          <option value="">Todos los estados</option>
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-r hover:bg-rl rounded-xl transition-all"
        >
          <X className="w-4 h-4" />
          Limpiar
        </button>
      )}
    </div>
  );
}
