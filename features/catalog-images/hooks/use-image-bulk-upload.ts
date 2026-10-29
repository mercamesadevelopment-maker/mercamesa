'use client';

import { useCallback, useMemo, useState } from 'react';
import { matchImageFiles, type ImageMatch, type ImageTarget } from '@/lib/catalog-images/match-files';
import { downloadImageCodes, fetchImageTargets, uploadCatalogImage } from '../services/catalog-images.service';

/** Fotos que se suben al tiempo: más satura la conexión de una tienda. */
const CONCURRENCY = 3;

export type UploadStep = 'pick' | 'preview' | 'uploading' | 'done';

export interface UploadFailure {
  fileName: string;
  message: string;
}

export function useImageBulkUpload(storeId?: string) {
  const [step, setStep] = useState<UploadStep>('pick');
  const [targets, setTargets] = useState<ImageTarget[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [replace, setReplace] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTargets(await fetchImageTargets(storeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de productos.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const matches: ImageMatch[] = useMemo(
    () => (targets ? matchImageFiles(files.map((f) => ({ name: f.name, size: f.size })), targets) : []),
    [files, targets]
  );

  /** Lo que se va a subir: las que coinciden, y las que reemplazan si se pidió. */
  const toUpload = useMemo(
    () => matches.filter((m) => m.status === 'ok' || (replace && m.status === 'replaces')),
    [matches, replace]
  );

  const pickFiles = useCallback((list: FileList | File[] | null) => {
    const nuevos = Array.from(list ?? []);
    if (nuevos.length === 0) return;
    setFiles(nuevos);
    setStep('preview');
  }, []);

  const upload = useCallback(async () => {
    setStep('uploading');
    setFailures([]);
    setUploaded(0);
    setProgress({ done: 0, total: toUpload.length });

    const cola = [...toUpload];
    const fallas: UploadFailure[] = [];
    let ok = 0;

    // Si una foto falla se sigue con las demás: se reporta al final.
    const trabajador = async () => {
      for (let m = cola.shift(); m; m = cola.shift()) {
        try {
          await uploadCatalogImage(m.product!.id, files[m.index], storeId);
          ok += 1;
        } catch (e) {
          fallas.push({ fileName: m.fileName, message: e instanceof Error ? e.message : 'No se pudo subir.' });
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, cola.length) }, trabajador));

    setUploaded(ok);
    setFailures(fallas);
    setStep('done');
  }, [files, storeId, toUpload]);

  const reset = useCallback(() => {
    setStep('pick');
    setFiles([]);
    setReplace(false);
    setFailures([]);
    setUploaded(0);
    setError(null);
  }, []);

  const downloadCodes = useCallback(async () => {
    if (targets) await downloadImageCodes(targets);
  }, [targets]);

  return {
    step, targets, matches, toUpload, replace, setReplace, progress, failures, uploaded, error, loading,
    loadTargets, pickFiles, upload, reset, downloadCodes,
  };
}
