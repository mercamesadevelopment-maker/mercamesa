import React, { useState, useEffect } from 'react';
import { FileText, Eye, Upload, Check, AlertTriangle, AlertCircle, Loader } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Badge } from '@/src/components/Shared';

interface StoreDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  onSaved: () => void;
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
}: StoreDocumentsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [fileEdits, setFileEdits] = useState<Record<string, File>>({});
  const [statusEdits, setStatusEdits] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});

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
    try {
      for (const doc of documents) {
        const file = fileEdits[doc.id];
        const status = statusEdits[doc.id] || doc.status;

        // Save if status is edited or new file is uploaded
        if (file || status !== doc.status) {
          const formData = new FormData();
          formData.append('document_type_id', doc.id);
          formData.append('status', status);
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
      }
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al guardar los documentos.');
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
      <div className="p-8 space-y-6">
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
                Para que la tienda pueda invitar a nuevos miembros y operar en la plataforma,
                debes subir y marcar como <strong>Aprobado</strong> cada uno de los documentos requeridos.
              </div>
            </div>

            <div className="divide-y divide-mm-crd/40 border-t border-b border-mm-crd/40">
              {documents.map((doc) => {
                const isFileEdited = !!fileEdits[doc.id];
                const currentStatus = statusEdits[doc.id] || doc.status;
                const isStatusEdited = currentStatus !== doc.status;

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

                      {/* Status Selector */}
                      <select
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(doc.id, e.target.value as any)}
                        className="px-3 py-1.5 rounded-lg border border-mm-crd bg-white text-xs text-mm-g font-semibold focus:border-mm-g outline-none transition-all cursor-pointer shadow-sm min-h-[34px]"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="approved">Aprobado</option>
                        <option value="rejected">Rechazado</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleSave}
                loading={saving}
              >
                Guardar Cambios
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
