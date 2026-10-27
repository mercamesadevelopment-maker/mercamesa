/** Lo mínimo de un documento de tienda para decidir si está verificada. */
export interface StoreDocumentStatus {
  document_type_id: string;
  status: string;
}

/**
 * Una tienda está verificada cuando tiene aprobados todos los documentos
 * obligatorios (`document_types.is_required`).
 *
 * Si en Parametrización no queda ninguno obligatorio, la regla no puede ser
 * «todos los obligatorios» —sería verdad para cualquier tienda— ni «ninguna»,
 * que fue lo que pasó: bloqueaba a todas, aun con todo aprobado. Entonces vale
 * lo que la tienda subió: al menos un documento y todos aprobados.
 */
export function isStoreVerified(
  documents: StoreDocumentStatus[] | null | undefined,
  requiredTypeIds: string[]
): boolean {
  const docs = documents ?? [];

  if (requiredTypeIds.length === 0) {
    return docs.length > 0 && docs.every((d) => d.status === 'approved');
  }

  const approved = new Set(docs.filter((d) => d.status === 'approved').map((d) => d.document_type_id));
  return requiredTypeIds.every((id) => approved.has(id));
}
