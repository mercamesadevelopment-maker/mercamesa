import { useState, useCallback, useEffect } from 'react';
import { DocumentTypeRow, DocumentTypeInsert, DocumentTypeUpdate } from '../types/settings.types';
import { getDocumentTypesService, saveDocumentTypeService, deleteDocumentTypeService } from '../services/settings.service';

export function useDocumentTypes() {
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocumentTypesService();
      setDocumentTypes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar tipos de documento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocumentTypes();
  }, [fetchDocumentTypes]);

  const saveDocumentType = async (id: string | null, payload: DocumentTypeInsert | DocumentTypeUpdate) => {
    try {
      await saveDocumentTypeService(id, payload);
      await fetchDocumentTypes();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar tipo de documento');
    }
  };

  /** Relanza el error: la confirmación y el aviso son de la vista, no del hook. */
  const deleteDocumentType = async (id: string) => {
    try {
      await deleteDocumentTypeService(id);
      await fetchDocumentTypes();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al eliminar tipo de documento');
    }
  };

  return {
    documentTypes,
    loading,
    error,
    fetchDocumentTypes,
    saveDocumentType,
    deleteDocumentType,
  };
}
