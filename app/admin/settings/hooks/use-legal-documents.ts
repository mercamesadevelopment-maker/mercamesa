'use client';

import { useCallback, useEffect, useState } from 'react';
import { uploadFileDirect } from '@/lib/supabase/client-upload';
import {
  getLegalDocumentsService,
  publishLegalDocumentService,
  type LegalDocumentRow,
} from '../services/settings.service';

export type LegalKind = 'terms' | 'privacy';

export function useLegalDocuments() {
  const [documents, setDocuments] = useState<LegalDocumentRow[]>([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { documents: docs, activeUsers: activos } = await getLegalDocumentsService();
      setDocuments(docs);
      setActiveUsers(activos);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando los documentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  /**
   * Sube el PDF y lo publica.
   *
   * El archivo va **directo del navegador a Storage** y al servidor solo se le
   * manda la ruta, igual que el logo de una tienda: así no choca con el límite
   * de tamaño del cuerpo de las funciones serverless.
   */
  const publish = useCallback(
    async (kind: LegalKind, file: File, notes: string, minorFix: boolean) => {
      try {
        setSaving(true);
        setError(null);

        // La carpeta es el tipo de documento, y la ruta lleva la fecha: subir de
        // nuevo nunca pisa el archivo de una versión anterior, que es lo que
        // permite seguir abriendo lo que alguien aceptó en su momento.
        const path = `${kind}/${kind}-${Date.now()}.pdf`;
        await uploadFileDirect('legal', path, file);

        const { notified } = await publishLegalDocumentService({
          kind,
          file_path: path,
          file_name: file.name,
          notes,
          minor_fix: minorFix,
        });

        await fetchDocuments();
        return { ok: true as const, notified };
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error publicando el documento');
        return { ok: false as const, notified: null };
      } finally {
        setSaving(false);
      }
    },
    [fetchDocuments]
  );

  return { documents, activeUsers, loading, saving, error, fetchDocuments, publish, setError };
}
