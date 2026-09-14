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
  selectedStatus: OrderStatus | null;
  onStatusChange: (status: OrderStatus | null) => void;
  onClear: () => void;
}

// text-base en móvil: iOS hace zoom al enfocar campos de menos de 16px.
const SELECT_CLASS =
  'w-full min-w-0 bg-mm-gbg/50 border-none rounded-xl px-4 py-2.5 sm:py-2 text-base sm:text-sm text-mm-g outline-none focus:ring-2 ring-mm-g/20 transition-all cursor-pointer';

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

  const statuses: { id: OrderStatus; label: string }[] =
    Object.entries(ORDER_STATUS_LABELS).map(([id, label]) => ({
      id: id as OrderStatus,
      label,
    }));

  const hasFilters = selectedStoreId || selectedStatus;

  const renderClearButton = (className: string) =>
    hasFilters ? (
      <button
        onClick={onClear}
        className={cn(
          'items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold text-r hover:bg-rl rounded-xl transition-all',
          className
        )}
      >
        <X className="w-4 h-4" />
        Limpiar
      </button>
    ) : null;

  // En móvil "Limpiar" sube a la fila del título, a la derecha, en vez de caer
  // suelto debajo de los selects. En pantallas anchas conserva su lugar al final.
  return (
    <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-mm-crd shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div className="flex items-center justify-between sm:mr-2 min-h-8">
        <div className="flex items-center gap-2 text-mm-txw">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Filtros</span>
        </div>
        {renderClearButton('flex sm:hidden -my-1')}
      </div>

      <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <select
          value={selectedStoreId || ''}
          onChange={(e) => onStoreChange(e.target.value || null)}
          className={SELECT_CLASS}
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
          onChange={(e) =>
            onStatusChange(
              (e.target.value as OrderStatus) || null
            )
          }
          className={SELECT_CLASS}
        >
          <option value="">Todos los estados</option>

          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {renderClearButton('hidden sm:flex')}
    </div>
  );
}
