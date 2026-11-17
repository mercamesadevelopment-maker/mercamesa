import { useMemo } from 'react';
import { patchBatch, useGridDrafts } from '@/components/ui/editable-grid/hooks/useGridDrafts';
import {
  buildPriceBatch,
  changedFields,
  draftFromValues,
  PRICE_FIELDS,
  priceValueFromPaste,
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
 * Recibe todas las filas, no solo las filtradas: un cambio no se pierde porque
 * un filtro oculte su fila.
 */
export function usePriceGrid(rows: PriceGridRow[], units: UnitOption[], reload: () => Promise<void>) {
  const actuales = useMemo(() => new Map(rows.map((r) => [r.id, r.values])), [rows]);
  const originals = useMemo(() => new Map(rows.map((r) => [r.id, draftFromValues(r.id, r.values)])), [rows]);

  return useGridDrafts<PriceDraft, PriceBatchRow>({
    originals,
    fields: PRICE_FIELDS,
    parseCell: (field, texto) => priceValueFromPaste(field as PriceField, texto, units),
    changedFields: (o, d) => changedFields(o, d),
    build: (editadas) => buildPriceBatch(originals, editadas, actuales),
    save: (lote) => patchBatch('/api/store-products/batch', lote),
    reload,
  });
}
