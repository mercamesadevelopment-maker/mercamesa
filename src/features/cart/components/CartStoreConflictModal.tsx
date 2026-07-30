'use client';

import { useApp } from '@/src/store';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';

export function CartStoreConflictModal() {
  const { state, dispatch } = useApp();
  const conflict = state.cartStoreConflict;

  const handleClose = () => dispatch({ type: 'CLEAR_CART_STORE_CONFLICT' });

  return (
    <ConfirmModal
      isOpen={conflict !== null}
      onClose={handleClose}
      onConfirm={handleClose}
      title="Solo puedes pedir de una tienda a la vez"
      message={`Ya tienes productos de ${conflict?.currentStoreName ?? 'otra tienda'} en tu canasta. Para agregar productos de otra tienda, primero finaliza o vacía tu pedido actual.`}
      confirmText="Entendido"
      cancelText="Entendido"
      variant="warning"
    />
  );
}
