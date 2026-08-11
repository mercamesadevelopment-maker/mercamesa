'use client';

import { useCallback, useState } from 'react';
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from '@/lib/product-import/constants';
import { downloadTemplate, uploadBulkFile } from '../services/bulk-import.service';
import type { BulkImportStep, ImportReport } from '../types/bulk-import.types';

export function useBulkImport(storeId: string | null | undefined) {
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

  const handleDownloadTemplate = useCallback(async () => {
    if (!storeId) return;
    setError(null);
    setIsDownloading(true);
    try {
      await downloadTemplate(storeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar la plantilla.');
    } finally {
      setIsDownloading(false);
    }
  }, [storeId]);

  /** Envía el archivo con dry_run: valida y muestra el reporte sin escribir. */
  const validate = useCallback(async () => {
    if (!storeId || !file) return;
    setError(null);
    setIsProcessing(true);
    try {
      setReport(await uploadBulkFile(storeId, file, true));
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar el archivo.');
    } finally {
      setIsProcessing(false);
    }
  }, [storeId, file]);

  /**
   * Reenvía el mismo archivo, ahora sí escribiendo. Se manda de nuevo en vez de
   * confiar en lo validado en el cliente: el servidor vuelve a validar todo.
   */
  const confirm = useCallback(async () => {
    if (!storeId || !file) return;
    setError(null);
    setIsProcessing(true);
    try {
      setReport(await uploadBulkFile(storeId, file, false));
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar el archivo.');
    } finally {
      setIsProcessing(false);
    }
  }, [storeId, file]);

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
    downloadTemplate: handleDownloadTemplate,
    validate,
    confirm,
  };
}
