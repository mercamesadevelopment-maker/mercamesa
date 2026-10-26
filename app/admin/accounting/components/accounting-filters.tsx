'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { AccountingOptions } from '@/lib/accounting/types';
import type { AccountingFilterValues } from '../hooks/use-accounting-filters';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const PRIMER_ANO = 2025;

interface AccountingFiltersProps {
  values: AccountingFilterValues;
  options: AccountingOptions;
  hasFilters: boolean;
  onChange: (changes: Partial<AccountingFilterValues>) => void;
  onClear: () => void;
}

/** Cliente, plaza, tienda y mes o año. Aplican a todas las pestañas. */
export function AccountingFilters({ values, options, hasFilters, onChange, onClear }: AccountingFiltersProps) {
  // El cliente se escribe: se espera a que deje de teclear para no pedir una
  // búsqueda por letra.
  const [buyer, setBuyer] = useState(values.buyer);
  useEffect(() => setBuyer(values.buyer), [values.buyer]);
  useEffect(() => {
    if (buyer === values.buyer) return;
    const t = setTimeout(() => onChange({ buyer: buyer.trim() }), 400);
    return () => clearTimeout(t);
  }, [buyer, values.buyer, onChange]);

  const anoActual = new Date().getFullYear();
  const anos = Array.from({ length: anoActual - PRIMER_ANO + 1 }, (_, i) => String(anoActual - i));

  // Con una plaza elegida, la lista de tiendas se reduce a las suyas.
  const tiendas = options.stores
    .filter((s) => !values.marketplaceId || s.marketplaceId === values.marketplaceId)
    .map((s) => ({ value: s.id, label: s.name }));

  const selectClass =
    'w-40 rounded-2xl border border-mm-crd bg-white px-4 py-2.5 text-sm font-medium text-mm-g focus:outline-none focus:ring-2 focus:ring-mm-g/20 disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-mm-crd bg-white p-4">
      <label className="relative flex min-w-[16rem] flex-[2] items-center">
        <span className="sr-only">Cliente</span>
        <Search className="pointer-events-none absolute left-4 h-4 w-4 text-mm-txw" />
        <input
          type="text"
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          placeholder="Cliente: nombre, documento o correo"
          className="w-full rounded-2xl border border-mm-crd bg-white py-2.5 pl-10 pr-4 text-sm text-mm-g placeholder:text-mm-txw focus:outline-none focus:ring-2 focus:ring-mm-g/20"
        />
      </label>

      <div className="min-w-[11rem] flex-1">
      <SearchableSelect
        options={[{ value: '', label: 'Todas las plazas' }, ...options.marketplaces.map((m) => ({ value: m.id, label: m.name }))]}
        value={values.marketplaceId}
        onChange={(v) => {
          // La tienda elegida puede no ser de la nueva plaza: se quita en el mismo cambio.
          const tiendaFuera =
            v && values.storeId && !options.stores.some((s) => s.id === values.storeId && s.marketplaceId === v);
          onChange(tiendaFuera ? { marketplaceId: v, storeId: '' } : { marketplaceId: v });
        }}
        placeholder="Todas las plazas"
      />
      </div>

      <div className="min-w-[11rem] flex-1">
      <SearchableSelect
        options={[{ value: '', label: 'Todas las tiendas' }, ...tiendas]}
        value={values.storeId}
        onChange={(v) => onChange({ storeId: v })}
        placeholder="Todas las tiendas"
      />
      </div>

      <select
        aria-label="Año"
        value={values.year}
        onChange={(e) => onChange({ year: e.target.value })}
        className={selectClass}
      >
        <option value="">Todos los años</option>
        {anos.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      <select
        aria-label="Mes"
        value={values.month}
        disabled={!values.year}
        onChange={(e) => onChange({ month: e.target.value })}
        className={selectClass}
        title={values.year ? undefined : 'Elige primero el año'}
      >
        <option value="">Todo el año</option>
        {MESES.map((m, i) => (
          <option key={m} value={String(i + 1)}>{m}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={onClear}
        disabled={!hasFilters}
        className="flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold text-mm-txs hover:bg-mm-gbg disabled:opacity-40"
      >
        <X className="h-4 w-4" />
        Limpiar
      </button>
    </div>
  );
}
