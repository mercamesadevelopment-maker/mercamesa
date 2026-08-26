import { useOrders } from '../hooks/use-orders';
import { OrdersView as OrdersViewShared } from '@/src/features/orders/components/OrdersView';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';

export function OrdersView() {
  const {
    filteredOrders,
    filterStatus,
    setFilterStatus,
    stats,
    updateOrderStatus,
    stores,
    selectedStoreId,
    setSelectedStoreId,
    deliveryError,
    dismissDeliveryError,
  } = useOrders();

  return (
    <>
      <OrdersViewShared
        variant="seller"
        filteredOrders={filteredOrders}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        stats={stats}
        updateOrderStatus={updateOrderStatus}
        stores={stores}
        selectedStoreId={selectedStoreId}
        setSelectedStoreId={setSelectedStoreId}
      />

      {/* El pedido cambia de estado aunque Pibox falle, pero el vendedor tiene
          que enterarse de que no hay mensajero en camino. */}
      <ConfirmModal
        isOpen={!!deliveryError}
        onClose={dismissDeliveryError}
        onConfirm={dismissDeliveryError}
        title="No se pudo solicitar el domicilio"
        message={`${deliveryError || ''}

El pedido sí quedó marcado como listo para recogida. Corrige el dato y vuelve a intentarlo, o coordina el domicilio manualmente.`}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />
    </>
  );
}
