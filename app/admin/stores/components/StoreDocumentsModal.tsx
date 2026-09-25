import React from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { StoreDocumentsPanel } from '@/src/features/stores/components/StoreDocumentsPanel';

/**
 * La documentación de una tienda, en un modal.
 *
 * El contenido vive en `StoreDocumentsPanel`, que comparte con la pestaña
 * «Documentos» de /seller/settings: el tendero necesita llegar a lo mismo sin
 * que haya un modal de por medio, porque el suyo deja de ofrecerse en cuanto
 * todo queda aprobado.
 */

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

export function StoreDocumentsModal({
  isOpen,
  onClose,
  storeId,
  storeName,
  onSaved,
  canReview = false,
}: StoreDocumentsModalProps) {
  // Cerrado no se monta el panel, así que no consulta documentos ni conserva
  // nada de la apertura anterior: entre una y otra pudieron guardarse cambios, y
  // mostrar el historial de antes sería mentir sobre el estado. Los dos sitios
  // que lo usan ya lo montan condicionalmente; esto lo deja cierto igual.
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Documentos de ${storeName}`}
      maxWidth="max-w-3xl"
    >
      <div className="p-4 sm:p-8">
        <StoreDocumentsPanel
          storeId={storeId}
          canReview={canReview}
          onCancel={onClose}
          onSaved={() => {
            onSaved();
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}
