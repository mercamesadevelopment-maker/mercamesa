'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { EditableGrid } from '@/components/ui/editable-grid/components/EditableGrid';
import { GridSaveBar } from '@/components/ui/editable-grid/components/GridSaveBar';
import { GridPager } from '@/components/ui/editable-grid/components/GridPager';
import type { GridColumn } from '@/components/ui/editable-grid/types';
import { Badge } from '@/components/ui/badge';
import type { CategoryOption, PriceField, UnitOption } from '@/lib/store-products/price-grid';
import type { usePriceGrid } from '../hooks/usePriceGrid';
import { nextSort, sortRows, type SortState, type SortValue } from '@/lib/utils/sort-rows';
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
  /**
   * Columna «Categoría» editable (solo el admin). Es del catálogo maestro: el
   * cambio vale para todas las tiendas del producto. Requiere `usePriceGrid`
   * con las mismas categorías.
   */
  categories?: CategoryOption[];
  /** Columna «Categoría» de solo lectura, «Categoría › Subcategoría» (la tabla del tendero). */
  showCategory?: boolean;
}

const EDITABLES = new Set<string>(['category', 'unit', 'price', 'wsPrice', 'wsMin', 'stock', 'isActive']);
const pct = (rate: number) => `${Math.round(rate * 100)} %`;

/** Columnas que no ordenan: la selección. Las acciones no son columna. */
const NO_ORDENAN = new Set<string>(['select']);

/**
 * Productos de tienda como una hoja de cálculo. Orden: código y producto (solo
 * lectura), tienda (admin), categoría, y de ahí lo editable —unidad, precios,
 * stock, publicado—. Producto e IVA son del catálogo maestro y se editan en
 * `/admin/products`.
 *
 * Se ordena por columna con el encabezado, por lo guardado y no por lo que se
 * está escribiendo: una fila no salta de lugar a mitad de la edición.
 */
export function PriceGrid({ rows, grid, units, rowActions, showStore, selection, categories, showCategory }: PriceGridProps) {
  const [sort, setSort] = useState<SortState>({ key: null, order: 'asc' });

  const unitName = useMemo(() => new Map(units.map((u) => [u.id, u.abbreviation || u.name])), [units]);
  const categoryName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.label])), [categories]);
  const conCategoria = Boolean(categories) || Boolean(showCategory);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const valueOf = (r: PriceGridRow): SortValue => {
      switch (sort.key) {
        case 'code': return r.code;
        case 'name': return r.name;
        case 'store': return r.storeName;
        case 'category': return categories ? categoryName.get(r.values.categoryId ?? '') : r.categoryLabel;
        case 'unit': return unitName.get(r.values.unitId ?? '');
        case 'price': return r.values.price;
        case 'wsPrice': return r.values.wsPrice;
        case 'wsMin': return r.values.wsMin;
        case 'stock': return r.values.stock;
        case 'iva': return r.ivaRate;
        case 'isActive': return r.values.isActive;
        default: return null;
      }
    };
    return sortRows(rows, valueOf, sort.order);
  }, [rows, sort, categories, categoryName, unitName]);

  // Paginación en el navegador: las filas ya están todas acá. Si cambian los
  // filtros o el orden, vuelve a la primera página.
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  useEffect(() => setPage(1), [rows.length, rowsPerPage, sort]);
  const totalPages = rowsPerPage === 0 ? 1 : Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const pageRows = useMemo(
    () => (rowsPerPage === 0 ? sorted : sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage)),
    [sorted, page, rowsPerPage]
  );

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
                {!conCategoria && r.cat}
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
    if (categories) {
      cols.push({
        key: 'category',
        label: 'Categoría',
        type: 'select',
        width: '15rem',
        options: [{ value: '', label: 'Sin categoría' }, ...categories.map((c) => ({ value: c.id, label: c.label }))],
      });
    } else if (showCategory) {
      cols.push({
        key: 'category',
        label: 'Categoría',
        type: 'readonly',
        width: '15rem',
        render: (r) => (
          <span className="block truncate text-xs text-mm-txs" title={r.categoryLabel}>
            {r.categoryLabel || 'Sin categoría'}
          </span>
        ),
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
      { key: 'isActive', label: 'Publicado', type: 'checkbox', width: '6rem' }
    );
    return cols.map((c) => (NO_ORDENAN.has(c.key) ? c : { ...c, sortable: true }));
  }, [units, showStore, selection, categories, showCategory, conCategoria]);

  const visibleIds = pageRows.map((r) => r.id);
  const columnKeys = columns.map((c) => c.key);

  return (
    <div className="space-y-3">
      <GridSaveBar
        grid={grid}
        ayuda={
          <>
            Escribe sobre la celda o pega columnas desde Excel. Flechas, Tab y Enter para moverte. Decimales con coma:{' '}
            <span className="font-mono">2,5</span>. Producto e IVA se cambian en el catálogo maestro. Los cambios se guardan aunque cambies de página.
          </>
        }
      />
      <EditableGrid<PriceGridRow>
        rows={pageRows}
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
        sortKey={sort.key}
        sortOrder={sort.order}
        onSort={(key) => setSort((actual) => nextSort(actual, key))}
      />
      <GridPager
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={setRowsPerPage}
        total={rows.length}
        allowAll
      />
    </div>
  );
}
