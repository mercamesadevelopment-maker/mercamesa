import { useEffect, useRef, useState } from 'react';
import { summarizeImport, type ImportTarget } from '@/lib/store-products/price-import';
import type { PriceSheetProduct } from '@/lib/store-products/price-workbook';
import type { UnitOption } from '@/lib/store-products/price-grid';
import type { GridDrafts } from '@/components/ui/editable-grid/hooks/useGridDrafts';
import { exportPriceWorkbook, importPriceWorkbook } from '../services/price-workbook.service';

export interface PriceWorkbookSummary {
  tone: 'ok' | 'error';
  title: string;
  notes: string[];
}

/**
 * Los botones «Exportar Excel» e «Importar Excel» de «Mis productos».
 *
 * Importar no guarda: vuelca los cambios en la tabla (`grid.applyCells`) y el
 * tendero los revisa y le da «Guardar». Si ya había cambios sin guardar, se
 * pregunta antes de mezclarlos con los del archivo.
 */
export function usePriceWorkbook(params: {
  grid: Pick<GridDrafts, 'applyCells' | 'changedCount' | 'savedCount'>;
  targets: ImportTarget[];
  products: () => PriceSheetProduct[];
  units: UnitOption[];
  storeLabel: string;
  withStore: boolean;
  /** Para que se vean las filas importadas: quita búsqueda y filtros. */
  onImported: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<PriceWorkbookSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Guardado lo importado, el aviso («dale Guardar») ya no aplica.
  useEffect(() => {
    if (params.grid.savedCount !== null) setSummary(null);
  }, [params.grid.savedCount]);

  const exportar = async () => {
    setExporting(true);
    setSummary(null);
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      await exportPriceWorkbook({
        fileName: `productos-${slug(params.storeLabel)}-${fecha}.xlsx`,
        title: `Mis productos — ${params.storeLabel}`,
        products: params.products(),
        units: params.units,
        withStore: params.withStore,
      });
    } catch (e) {
      setSummary({ tone: 'error', title: e instanceof Error ? e.message : 'No se pudo generar el Excel.', notes: [] });
    } finally {
      setExporting(false);
    }
  };

  /** Abre el selector de archivo; con cambios sin guardar, pregunta antes. */
  const pedirArchivo = () => {
    if (params.grid.changedCount > 0) setConfirmOpen(true);
    else fileInput.current?.click();
  };

  const confirmar = () => {
    setConfirmOpen(false);
    fileInput.current?.click();
  };

  const importar = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setImporting(true);
    setSummary(null);
    try {
      const plan = await importPriceWorkbook(file, params.targets, params.units);
      params.grid.applyCells(plan.changes, plan.errors);
      if (plan.productsTouched > 0 || plan.errors.length > 0) params.onImported();
      setSummary({ tone: 'ok', ...summarizeImport(plan) });
    } catch (e) {
      setSummary({ tone: 'error', title: e instanceof Error ? e.message : 'No se pudo leer el archivo.', notes: [] });
    } finally {
      setImporting(false);
    }
  };

  return {
    fileInput,
    exporting,
    importing,
    summary,
    dismissSummary: () => setSummary(null),
    exportar,
    pedirArchivo,
    importar,
    confirmOpen,
    confirmar,
    cancelar: () => setConfirmOpen(false),
  };
}

function slug(valor: string): string {
  return (
    valor
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'tienda'
  );
}
