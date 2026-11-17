'use client';

import React, { useMemo } from 'react';
import { EditableGrid } from '@/components/ui/editable-grid/components/EditableGrid';
import { GridSaveBar } from '@/components/ui/editable-grid/components/GridSaveBar';
import type { GridColumn } from '@/components/ui/editable-grid/types';
import { Badge } from '@/components/ui/badge';
import type { PriceField, UnitOption } from '@/lib/store-products/price-grid';
import type { usePriceGrid } from '../hooks/usePriceGrid';
import type { PriceGridRow } from '../types';

interface PriceGridProps {
  /** Las filas visibles (ya filtradas). */
  rows: PriceGridRow[];
  grid: ReturnType<typeof usePriceGrid>;
  units: UnitOption[];
  rowActions?: (row: PriceGridRow) => React.ReactNode;
  /** Columna «Tienda»: en el admin, que ve todas. */
  showStore?: boolean;
  /** Casilla de selección por fila (p. ej. «Asignar seleccionados»). */
  selection?: { selected: Set<string>; toggle: (id: string) => void };
}

const EDITABLES = new Set<string>(['unit', 'price', 'wsPrice', 'wsMin', 'stock', 'isActive']);
const pct = (rate: number) => `${Math.round(rate * 100)} %`;

/**
 * Productos de tienda como una hoja de cálculo. Orden: código y producto (solo
 * lectura), tienda (admin), y de ahí lo editable —unidad, precios, stock,
 * publicado— hasta la descripción. Producto, IVA y descripción son del catálogo
 * maestro y se editan en `/admin/products`.
 */
export function PriceGrid({ rows, grid, units, rowActions, showStore, selection }: PriceGridProps) {
  const columns = useMemo(() => {
    const cols: GridColumn<PriceGridRow>[] = [];
    if (selection) {
      cols.push({
        key: 'select',
        label: 'Sel.',
        type: 'readonly',
        width: '3rem',
        render: (r) => (
          <input
            type="checkbox"
            aria-label={`Seleccionar ${r.name}`}
            checked={selection.selected.has(r.id)}
            onChange={() => selection.toggle(r.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer accent-tinta"
          />
        ),
      });
    }
    cols.push(
      {
        key: 'code',
        label: 'Código',
        type: 'readonly',
        width: '7rem',
        render: (r) => (
          <span className="block truncate font-mono text-xs text-mm-txs" title={r.code}>
            {r.code || '—'}
          </span>
        ),
      },
      {
        key: 'name',
        label: 'Producto',
        type: 'readonly',
        width: '17rem',
        render: (r) => (
          <div className="flex items-center gap-2 py-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-mm-crd bg-mm-gbg">
              {r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : <span>{r.emoji ?? '📦'}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-tinta">{r.name}</p>
              <p className="flex items-center gap-1 truncate text-[10px] font-mono text-mm-txw">
                {r.cat}
                {r.inReview && (
                  <Badge variant="warning" className="px-1 py-0 text-[9px]">
                    En revisión
                  </Badge>
                )}
              </p>
            </div>
          </div>
        ),
      }
    );
    if (showStore) {
      cols.push({
        key: 'store',
        label: 'Tienda',
        type: 'readonly',
        width: '10rem',
        render: (r) => <span className="block truncate text-xs text-mm-txs">{r.storeName ?? '—'}</span>,
      });
    }
    cols.push(
      {
        key: 'unit',
        label: 'Unidad',
        type: 'select',
        width: '7rem',
        options: [{ value: '', label: '—' }, ...units.map((u) => ({ value: u.id, label: u.abbreviation || u.name }))],
      },
      { key: 'price', label: 'Precio', type: 'number', width: '8rem', placeholder: 'Precio' },
      { key: 'wsPrice', label: 'Precio mayorista', type: 'number', width: '8rem', placeholder: 'Sin mayorista' },
      { key: 'wsMin', label: 'Mín. mayorista', type: 'number', width: '7rem', placeholder: '—' },
      { key: 'stock', label: 'Stock', type: 'number', width: '6rem' },
      {
        key: 'iva',
        label: 'IVA',
        type: 'readonly',
        width: '5rem',
        render: (r) => <span className="whitespace-nowrap font-mono text-xs text-mm-txs">{pct(r.ivaRate)}</span>,
      },
      { key: 'isActive', label: 'Publicado', type: 'checkbox', width: '6rem' },
      {
        key: 'description',
        label: 'Descripción',
        type: 'readonly',
        width: '16rem',
        render: (r) => (
          <span className="block truncate text-xs text-mm-txs" title={r.description}>
            {r.description || '—'}
          </span>
        ),
      }
    );
    return cols;
  }, [units, showStore, selection]);

  const visibleIds = rows.map((r) => r.id);
  const columnKeys = columns.map((c) => c.key);

  return (
    <div className="space-y-3">
      <GridSaveBar
        grid={grid}
        ayuda={
          <>
            Escribe sobre la celda o pega columnas desde Excel. Flechas, Tab y Enter para moverte. Decimales con coma:{' '}
            <span className="font-mono">2,5</span>. Producto, IVA y descripción se cambian en el catálogo maestro.
          </>
        }
      />
      <EditableGrid<PriceGridRow>
        rows={rows}
        columns={columns}
        getRowKey={(r) => r.id}
        getValue={(r, key) => {
          if (!EDITABLES.has(key)) return '';
          const d = grid.draftOf(r.id);
          return d ? d[key as PriceField] : '';
        }}
        onCellChange={(id, key, value) => grid.updateCell(id, key, value)}
        onPaste={(id, key, texto) => grid.paste(visibleIds, id, key, texto, columnKeys)}
        isChanged={grid.isChanged}
        errors={grid.errores}
        rowActions={rowActions}
        emptyMessage="No se encontraron productos con estos filtros."
        maxHeight="70vh"
      />
    </div>
  );
}
