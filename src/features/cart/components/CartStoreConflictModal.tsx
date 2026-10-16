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
      title="Estas tiendas no despachan juntas."
      message={
        <>
          Tu carrito tiene productos de{' '}
          <strong className="font-bold text-mm-g">
            {conflict?.currentStoreName ?? 'otra tienda'}
          </strong>
          . En un mismo pedido puedes juntar tiendas de la misma plaza, porque
          salen en una sola entrega; esta tienda despacha desde otro lugar.
          Termina tu pedido o vacía el carrito para comprar acá.
        </>
      }
      confirmText="Entendido"
      cancelText="Cerrar"
      variant="warning"
    />
  );
}
