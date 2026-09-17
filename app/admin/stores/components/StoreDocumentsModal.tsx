import React, { useState, useEffect } from 'react';
import { FileText, Eye, Upload, Check, AlertTriangle, AlertCircle, Loader } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { Button, Badge } from '@/src/components/Shared';

interface StoreDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  onSaved: () => void;
  /**
   * Habilita decidir el estado (Pendiente/Aprobado/Rechazado).
   *
   * Por defecto `false`: este modal también lo abre el tendero desde
   * /seller/onboarding, y aprobar su propia documentación es justamente lo que
   * no puede hacer. Él sube y consulta; el estado lo decide el administrador.
   *
   * Es comodidad de interfaz, no la protección: quien manda es el servidor, que
   * ignora el estado que venga de quien no tenga permiso de administración.
   */
  canReview?: boolean;
}

interface DocumentItem {
  id: string; // document_type_id
  name: string;
  slug: string;
  is_required: boolean;
  document_id: string | null;
  file_url: string | null;
  signedUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  uploaded_at: string | null;
}

export function StoreDocumentsModal({
  isOpen,
  onClose,
  storeId,
  storeName,
  onSaved,
  canReview = false,
}: StoreDocumentsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [fileEdits, setFileEdits] = useState<Record<string, File>>({});
  const [statusEdits, setStatusEdits] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});
  // El repo no tiene librería de toasts: los errores posteriores a una acción se
  // muestran con ConfirmModal, igual que en la pestaña de parametrización.
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/stores/${storeId}/documents`);
      const json = await res.json();
      if (json.data) {
        setDocuments(json.data);
      }
    } catch (err) {
      console.error('Error fetching store documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocs();
      setFileEdits({});
      setStatusEdits({});
    }
  }, [isOpen, storeId]);

  const handleFileChange = (docTypeId: string, file: File | undefined) => {
    if (file) {
      setFileEdits((prev) => ({ ...prev, [docTypeId]: file }));
    }
  };

  const handleStatusChange = (docTypeId: string, status: 'pending' | 'approved' | 'rejected') => {
    setStatusEdits((prev) => ({ ...prev, [docTypeId]: status }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Se corta antes de mandar nada: sin archivo, el documento no puede
      // existir, y el servidor respondería con un error por cada uno.
      if (canReview) {
        const sinArchivo = documents.filter(
          (d) => !d.file_url && !fileEdits[d.id] && (statusEdits[d.id] || d.status) !== d.status
        );
        if (sinArchivo.length > 0) {
          const nombres = sinArchivo.map((d) => `«${d.name}»`).join(', ');
          throw new Error(
            `Primero debes subir el archivo de ${nombres} para poder cambiar su estado.`
          );
        }
      }

      for (const doc of documents) {
        const file = fileEdits[doc.id];
        const status = statusEdits[doc.id] || doc.status;

        // Sin permiso de revisión lo único que se envía son archivos nuevos.
        const hayCambio = canReview ? file || status !== doc.status : !!file;
        if (!hayCambio) continue;

        const formData = new FormData();
        formData.append('document_type_id', doc.id);

        // El estado solo viaja cuando quien guarda puede decidirlo. Si no, el
        // servidor lo resuelve: un archivo nuevo vuelve a quedar en revisión.
        // Mandarlo igual era lo que rompía el reemplazo de un documento ya
        // aprobado — el servidor veía «approved» y respondía 403.
        if (canReview) {
          formData.append('status', status);
        }

        if (file) {
          formData.append('file', file);
        }
        if (doc.file_url && !file) {
          // If there's an existing file and we just change status, send the existing file_url
          formData.append('file_url', doc.file_url);
        }

        const res = await fetch(`/api/stores/${storeId}/documents`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al guardar el documento');
        }
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : 'Ocurrió un error al guardar los documentos.'
      );
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected', isEdited: boolean) => {
    const label = status === 'approved' ? 'Aprobado' : status === 'rejected' ? 'Rechazado' : 'Pendiente';
    const variant = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
    return (
      <div className="flex items-center gap-2">
        <Badge variant={variant as any}>{label}</Badge>
        {isEdited && <span className="text-[10px] font-bold text-mm-oro uppercase">Editado</span>}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Documentos de ${storeName}`}
      maxWidth="max-w-3xl"
    >
      <div className="p-4 sm:p-8 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-mm-txw">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-mm-g" />
            <p className="text-sm font-medium">Cargando documentación...</p>
          </div>
        ) : (
          <>
            <div className="bg-mm-gbg/20 p-4 rounded-2xl border border-mm-crd/50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-mm-g shrink-0 mt-0.5" />
              <div className="text-xs text-mm-g font-medium leading-relaxed">
                {canReview ? (
                  <>
                    Para que la tienda pueda invitar a nuevos miembros y operar en la plataforma,
                    debes subir y marcar como <strong>Aprobado</strong> cada uno de los documentos requeridos.
                  </>
                ) : (
                  <>
                    Sube cada uno de los documentos requeridos. Un administrador los revisará y
                    los marcará como <strong>Aprobado</strong>; hasta entonces la tienda no puede
                    invitar nuevos miembros ni operar en la plataforma. Si reemplazas un archivo
                    ya aprobado, vuelve a quedar en revisión.
                  </>
                )}
              </div>
            </div>

            <div className="divide-y divide-mm-crd/40 border-t border-b border-mm-crd/40">
              {documents.map((doc) => {
                const isFileEdited = !!fileEdits[doc.id];
                const currentStatus = statusEdits[doc.id] || doc.status;
                const isStatusEdited = currentStatus !== doc.status;
                // Ya subido antes, o seleccionado ahora y pendiente de guardar.
                const hasFile = !!doc.file_url || isFileEdited;

                return (
                  <div key={doc.id} className="py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 md:max-w-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-mm-txw shrink-0" />
                        <h4 className="font-bold text-mm-g text-sm">{doc.name}</h4>
                      </div>
                      <p className="text-[10px] text-mm-txw font-bold uppercase tracking-wide">
                        {doc.is_required ? 'Obligatorio' : 'Opcional'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* Document Status */}
                      {getStatusBadge(currentStatus, isStatusEdited || isFileEdited)}

                      {/* Download Link */}
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mm-gbg hover:bg-mm-crd text-xs text-mm-g font-bold border border-mm-crd/40 transition-colors"
                          title="Ver Documento"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </a>
                      ) : (
                        <span className="text-xs text-mm-txw italic">Sin archivo</span>
                      )}

                      {/* File Upload Trigger */}
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-mm-gbg border border-mm-crd text-xs text-mm-g font-bold cursor-pointer transition-all shadow-sm">
                        <Upload className="w-3.5 h-3.5 text-mm-txw" />
                        <span>{doc.file_url ? 'Reemplazar' : 'Subir'}</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => handleFileChange(doc.id, e.target.files?.[0])}
                          className="hidden"
                        />
                      </label>

                      {/* Status Selector. Solo para quien revisa; sin archivo no
                          hay estado que cambiar: el documento aún no existe. */}
                      {canReview && (
                        <select
                          value={currentStatus}
                          disabled={!hasFile}
                          title={!hasFile ? 'Sube primero el archivo para poder cambiar su estado' : undefined}
                          onChange={(e) => handleStatusChange(doc.id, e.target.value as any)}
                          className="px-3 py-1.5 rounded-lg border border-mm-crd bg-white text-xs text-mm-g font-semibold focus:border-mm-g outline-none transition-all cursor-pointer shadow-sm min-h-[34px] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-mm-gbg"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="approved">Aprobado</option>
                          <option value="rejected">Rechazado</option>
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="w-full sm:flex-1"
                onClick={handleSave}
                loading={saving}
              >
                Guardar Cambios
              </Button>
            </div>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!saveError}
        onClose={() => setSaveError(null)}
        onConfirm={() => setSaveError(null)}
        title="No se pudieron guardar los documentos"
        message={saveError ?? ''}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />
    </Modal>
  );
}
