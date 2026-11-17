'use client';

import React, { useMemo } from 'react';
import { Package } from 'lucide-react';
import { EditableGrid } from '@/components/ui/editable-grid/components/EditableGrid';
import { GridSaveBar } from '@/components/ui/editable-grid/components/GridSaveBar';
import { GridPager } from '@/components/ui/editable-grid/components/GridPager';
import type { GridColumn } from '@/components/ui/editable-grid/types';
import { Badge } from '@/components/ui/badge';
import { IVA_OPTIONS, type MasterField, type MasterOptions } from '@/lib/catalog/master-grid';
import type { useMasterGrid } from '../hooks/use-master-grid';

/** Lo mínimo que la tabla necesita de cada producto del catálogo. */
export interface MasterGridProduct {
  id: string;
  name: string;
  siigo_id: string | null;
  imageSignedUrl?: string | null;
  review_status?: string | null;
  proposed_by?: { name: string } | null;
}

interface MasterCatalogGridProps<T extends MasterGridProduct> {
  products: T[];
  grid: ReturnType<typeof useMasterGrid>;
  options: MasterOptions;
  rowActions: (product: T) => React.ReactNode;
  selection: { selected: Set<string | number>; toggle: (id: string) => void };
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (n: number) => void;
  /** Total de productos con los filtros puestos. */
  total?: number;
}

const EDITABLES = new Set<string>(['name', 'category', 'unit', 'iva', 'group', 'isActive']);

/**
 * El catálogo maestro como hoja de cálculo. Orden: código (no editable),
 * producto, categoría, unidad, IVA, exclusividad y activo.
 * La descripción, la foto y las banderas siguen en «Editar».
 */
export function MasterCatalogGrid<T extends MasterGridProduct>({
  products,
  grid,
  options,
  rowActions,
  selection,
  page,
  totalPages,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  total,
}: MasterCatalogGridProps<T>) {
  const columns = useMemo<GridColumn<T>[]>(
    () => [
      {
        key: 'select',
        label: 'Sel.',
        type: 'readonly',
        width: '3rem',
        render: (p) => (
          <input
            type="checkbox"
            aria-label={`Seleccionar ${p.name}`}
            checked={selection.selected.has(p.id)}
            onChange={() => selection.toggle(p.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer accent-tinta"
          />
        ),
      },
      {
        key: 'code',
        label: 'Código',
        type: 'readonly',
        width: '8rem',
        render: (p) => (
          <div className="flex min-w-0 items-center gap-2 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-mm-crd bg-mm-gbg">
              {p.imageSignedUrl ? (
                <img src={p.imageSignedUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <Package className="h-4 w-4 text-mm-txw" />
              )}
            </div>
            <span className="min-w-0 truncate font-mono text-xs text-mm-txs" title={p.siigo_id ?? undefined}>
              {p.siigo_id || '—'}
            </span>
          </div>
        ),
      },
      {
        key: 'name',
        label: 'Producto',
        type: 'text',
        width: '18rem',
        hint: (p) =>
          p.review_status === 'pending' ? (
            <Badge variant="oro" className="px-1 py-0 text-[9px]">
              En revisión{p.proposed_by?.name ? ` · ${p.proposed_by.name}` : ''}
            </Badge>
          ) : null,
      },
      {
        key: 'category',
        label: 'Categoría',
        type: 'select',
        width: '16rem',
        options: [{ value: '', label: 'Sin categoría' }, ...options.categories.map((c) => ({ value: c.id, label: c.label }))],
      },
      {
        key: 'unit',
        label: 'Unidad',
        type: 'select',
        width: '7rem',
        options: [{ value: '', label: '—' }, ...options.units.map((u) => ({ value: u.id, label: u.abbreviation || u.name }))],
      },
      { key: 'iva', label: 'IVA', type: 'select', width: '5.5rem', options: IVA_OPTIONS },
      {
        key: 'group',
        label: 'Exclusivo de',
        type: 'select',
        width: '10rem',
        options: [{ value: '', label: 'Público' }, ...options.groups.map((g) => ({ value: g.id, label: g.name }))],
      },
      { key: 'isActive', label: 'Activo', type: 'checkbox', width: '5rem' },
    ],
    [options, selection]
  );

  const visibleIds = products.map((p) => p.id);
  const columnKeys = columns.map((c) => c.key);

  return (
    <div className="space-y-3">
      <GridSaveBar
        grid={grid}
        ayuda={
          <>
            Escribe sobre la celda o pega columnas desde Excel. La categoría se pega como «Categoría › Subcategoría»; el
            IVA como 0, 5 o 19. Los cambios se guardan aunque cambies de página.
          </>
        }
      />
      <EditableGrid<T>
        rows={products}
        columns={columns}
        getRowKey={(p) => p.id}
        getValue={(p, key) => {
          if (!EDITABLES.has(key)) return '';
          const d = grid.draftOf(p.id);
          return d ? d[key as MasterField] : '';
        }}
        onCellChange={(id, key, value) => grid.updateCell(id, key, value)}
        onPaste={(id, key, texto) => grid.paste(visibleIds, id, key, texto, columnKeys)}
        isChanged={grid.isChanged}
        errors={grid.errores}
        rowActions={rowActions}
        emptyMessage="No se encontraron productos."
        maxHeight="65vh"
      />
      <GridPager
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        total={total}
      />
    </div>
  );
}
