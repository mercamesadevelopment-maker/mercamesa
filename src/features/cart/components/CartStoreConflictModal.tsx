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
      title="Solo puedes comprar productos de una tienda a la vez."
      message={
        <>
          Tu carrito contiene productos de{' '}
          <strong className="font-bold text-mm-g">
            {conflict?.currentStoreName ?? 'otra tienda'}
          </strong>
          . Para seguir comprando, agrega más productos de esa tienda. Si
          prefieres comprar en otra tienda, vacía el carrito y crea un nuevo
          pedido.
        </>
      }
      confirmText="Entendido"
      cancelText="Cerrar"
      variant="warning"
    />
  );
}
