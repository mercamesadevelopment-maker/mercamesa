import { useMemo } from 'react';
import { patchBatch, useGridDrafts, type SaveResult } from '@/components/ui/editable-grid/hooks/useGridDrafts';
import type { GridErrors } from '@/components/ui/editable-grid/types';
import {
  buildPriceBatch,
  changedFields,
  draftFromValues,
  PRICE_FIELDS,
  PRICE_FIELDS_WITH_CATEGORY,
  priceValueFromPaste,
  splitCategoryChanges,
  type CategoryOption,
  type PriceBatchRow,
  type PriceDraft,
  type PriceField,
  type UnitOption,
} from '@/lib/store-products/price-grid';
import type { PriceGridRow } from '../types';

/**
 * La tabla de precios mientras se edita: unidad, precio, mayorista, mínimo
 * mayorista, stock y publicado. La usan el tendero y Inventarios consolidados
 * del admin, y guardan los dos por `PATCH /api/store-products/batch`.
 *
 * Con `categories` (solo el admin) también se edita la categoría. Es del
 * producto en el catálogo maestro: se guarda primero ahí
 * (`PATCH /api/products/batch`) y vale para todas sus tiendas.
 *
 * Recibe todas las filas, no solo las filtradas: un cambio no se pierde porque
 * un filtro oculte su fila.
 */
export function usePriceGrid(
  rows: PriceGridRow[],
  units: UnitOption[],
  reload: () => Promise<void>,
  categories?: CategoryOption[]
) {
  const actuales = useMemo(() => new Map(rows.map((r) => [r.id, r.values])), [rows]);
  const originals = useMemo(() => new Map(rows.map((r) => [r.id, draftFromValues(r.id, r.values)])), [rows]);
  const catalogOf = useMemo(() => new Map(rows.map((r) => [r.id, r.catalogProductId])), [rows]);
  const conCategoria = Boolean(categories);

  const save = async (lote: PriceBatchRow[]): Promise<SaveResult> => {
    const split = splitCategoryChanges(lote, (id) => catalogOf.get(id));
    const errors: GridErrors = {};
    const categoriaGuardada = new Set<string>();

    // 1. La categoría, en el catálogo maestro.
    if (split.catalogRows.length > 0) {
      const r = await patchBatch('/api/products/batch', split.catalogRows);
      for (const [cat, errs] of Object.entries(r.errors ?? {})) {
        const mensaje = Object.values(errs)[0] ?? 'No se pudo cambiar la categoría.';
        for (const id of split.rowsByCatalog.get(cat) ?? []) errors[id] = { category: mensaje };
      }
      if (!r.ok) return { ok: false, error: r.error, errors };
      for (const cat of r.saved ?? []) for (const id of split.rowsByCatalog.get(cat) ?? []) categoriaGuardada.add(id);
    }

    // 2. Lo de la tienda.
    let tiendaGuardada = new Set<string>();
    if (split.storeRows.length > 0) {
      const r = await patchBatch('/api/store-products/batch', split.storeRows);
      Object.assign(errors, r.errors ?? {});
      if (!r.ok) return { ok: false, error: r.error, errors };
      tiendaGuardada = new Set(r.saved ?? []);
    }

    // Una fila quedó guardada si se guardó todo lo que cambió en ella.
    const saved = lote
      .filter((row) => {
        const { id, category_id, ...resto } = row;
        const okCategoria = category_id === undefined || categoriaGuardada.has(id);
        const okTienda = Object.keys(resto).length === 0 || tiendaGuardada.has(id);
        return okCategoria && okTienda;
      })
      .map((r) => r.id);

    return { ok: true, saved, errors };
  };

  return useGridDrafts<PriceDraft, PriceBatchRow>({
    originals,
    fields: conCategoria ? PRICE_FIELDS_WITH_CATEGORY : PRICE_FIELDS,
    parseCell: (field, texto) => priceValueFromPaste(field as PriceField, texto, units, categories ?? []),
    changedFields: (o, d) => changedFields(o, d),
    build: (editadas) => {
      const b = buildPriceBatch(originals, editadas, actuales);
      // Dos filas del mismo producto no pueden pedir categorías distintas.
      const choques = splitCategoryChanges(b.rows, (id) => catalogOf.get(id)).errors;
      for (const [id, e] of Object.entries(choques)) b.errors[id] = { ...b.errors[id], ...e };
      return b;
    },
    save,
    reload,
  });
}
