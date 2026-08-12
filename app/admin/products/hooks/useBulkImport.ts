'use client';

import { useCallback, useState } from 'react';
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from '@/lib/product-import/constants';
import type { ImportReport } from '@/lib/catalog-import/types';
import { downloadCatalogTemplate, uploadCatalogFile } from '../services/bulk-import.service';

export type BulkImportStep = 'upload' | 'preview' | 'done';

export function useBulkImport() {
  const [step, setStep] = useState<BulkImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setReport(null);
    setError(null);
    setIsProcessing(false);
    setIsDownloading(false);
  }, []);

  const selectFile = useCallback((selected: File | null) => {
    setError(null);
    setReport(null);

    if (!selected) {
      setFile(null);
      return;
    }

    const name = selected.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      setFile(null);
      setError(`El archivo debe ser ${ACCEPTED_EXTENSIONS.join(' o ')}.`);
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(`El archivo pesa más de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
      return;
    }

    setFile(selected);
  }, []);

  const downloadTemplate = useCallback(async () => {
    setError(null);
    setIsDownloading(true);
    try {
      await downloadCatalogTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar la plantilla.');
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const run = useCallback(
    async (dryRun: boolean, nextStep: BulkImportStep, fallback: string) => {
      if (!file) return;
      setError(null);
      setIsProcessing(true);
      try {
        setReport(await uploadCatalogFile(file, dryRun));
        setStep(nextStep);
      } catch (err) {
        setError(err instanceof Error ? err.message : fallback);
      } finally {
        setIsProcessing(false);
      }
    },
    [file]
  );

  /** Valida sin escribir: mismo endpoint, así la vista previa no puede diferir. */
  const validate = useCallback(
    () => run(true, 'preview', 'No se pudo validar el archivo.'),
    [run]
  );

  /** Reenvía el archivo, ahora sí escribiendo; el servidor revalida todo. */
  const confirm = useCallback(
    () => run(false, 'done', 'No se pudo crear los productos.'),
    [run]
  );

  const backToUpload = useCallback(() => {
    setStep('upload');
    setReport(null);
    setError(null);
  }, []);

  return {
    step,
    file,
    report,
    error,
    isDownloading,
    isProcessing,
    selectFile,
    reset,
    backToUpload,
    downloadTemplate,
    validate,
    confirm,
  };
}
