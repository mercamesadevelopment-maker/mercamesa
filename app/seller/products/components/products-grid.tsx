'use client';

import React from 'react';
import { Save, Undo2 } from 'lucide-react';
import { EditableGrid } from '@/components/ui/editable-grid/components/EditableGrid';
import type { GridColumn } from '@/components/ui/editable-grid/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/features/products/types/product.types';
import type { PriceField } from '@/lib/store-products/price-grid';
import type { useProductsGrid } from '../hooks/use-products-grid';

interface ProductsGridProps {
  /** Las filas visibles (ya filtradas). */
  products: Product[];
  grid: ReturnType<typeof useProductsGrid>;
  rowActions: (product: Product) => React.ReactNode;
}

const COLUMNS: GridColumn<Product>[] = [
  {
    key: 'name',
    label: 'Producto',
    type: 'readonly',
    width: '18rem',
    render: (p) => (
      <div className="flex items-center gap-2 py-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-mm-crd bg-mm-gbg">
          {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <span>{p.emoji}</span>}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-tinta">{p.name}</p>
          <p className="flex items-center gap-1 truncate text-[10px] font-mono text-mm-txw">
            {p.cat} · {p.unit}
            {p.inReview && <Badge variant="warning" className="px-1 py-0 text-[9px]">En revisión</Badge>}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: 'code',
    label: 'Código',
    type: 'readonly',
    width: '7rem',
    render: (p) => <span className="font-mono text-xs text-mm-txs">{p.code || '—'}</span>,
  },
  { key: 'price', label: 'Precio', type: 'number', width: '8rem', placeholder: 'Precio' },
  { key: 'wsPrice', label: 'Precio mayorista', type: 'number', width: '8rem', placeholder: 'Sin mayorista' },
  { key: 'wsMin', label: 'Mín. mayorista', type: 'number', width: '7rem', placeholder: '—' },
  { key: 'stock', label: 'Stock', type: 'number', width: '6rem' },
  { key: 'isActive', label: 'Publicado', type: 'checkbox', width: '6rem' },
];

const EDITABLES = new Set<string>(['price', 'wsPrice', 'wsMin', 'stock', 'isActive']);

/**
 * Los productos del tendero como una hoja de cálculo: precio, mayorista, stock
 * y publicado se escriben sobre la celda, se pegan desde Excel y se guardan
 * todos juntos. El resto (unidad, código, destacado) sigue en «Editar».
 */
export function ProductsGrid({ products, grid, rowActions }: ProductsGridProps) {
  const visibleIds = products.map((p) => String(p.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-mm-txs">
          Escribe sobre la celda o pega una columna desde Excel. Flechas, Tab y Enter para moverte.
          Decimales con coma: <span className="font-mono">2,5</span>.
        </p>
        <div className="flex items-center gap-2">
          {grid.changedCount > 0 ? (
            <span className="font-mono text-[11px] uppercase tracking-wider text-tinta">
              {grid.changedCount} {grid.changedCount === 1 ? 'cambio' : 'cambios'}
              {grid.errorCount > 0 && (
                <span className="text-arcilla-oscura">
                  {' '}· {grid.errorCount} {grid.errorCount === 1 ? 'error' : 'errores'}
                </span>
              )}
            </span>
          ) : (
            grid.savedCount !== null && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-salvia">
                {grid.savedCount} guardado{grid.savedCount === 1 ? '' : 's'}
              </span>
            )
          )}
          <Button variant="outline" size="sm" onClick={grid.discard} disabled={grid.changedCount === 0 || grid.saving}>
            <Undo2 className="mr-1 h-4 w-4" /> Descartar
          </Button>
          <Button
            size="sm"
            onClick={grid.save}
            loading={grid.saving}
            disabled={grid.changedCount === 0 || grid.errorCount > 0}
          >
            <Save className="mr-1 h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      {grid.saveError && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-rl px-4 py-2 text-sm text-r">
          <span>{grid.saveError}</span>
          <button type="button" onClick={grid.clearSaveError} className="text-xs font-semibold underline">
            Cerrar
          </button>
        </div>
      )}

      <EditableGrid<Product>
        rows={products}
        columns={COLUMNS}
        getRowKey={(p) => String(p.id)}
        getValue={(p, key) => {
          if (!EDITABLES.has(key)) return '';
          const d = grid.draftOf(String(p.id));
          return d ? d[key as PriceField] : '';
        }}
        onCellChange={(id, key, value) => {
          if (EDITABLES.has(key)) grid.updateCell(id, key as PriceField, value);
        }}
        onPaste={(id, key, texto) => {
          if (EDITABLES.has(key)) grid.paste(visibleIds, id, key as PriceField, texto);
        }}
        isChanged={grid.isChanged}
        errors={grid.errores}
        rowActions={rowActions}
        emptyMessage="No se encontraron productos con estos filtros."
        maxHeight="70vh"
      />
    </div>
  );
}
