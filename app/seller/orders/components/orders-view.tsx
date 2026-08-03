import { useOrders } from '../hooks/use-orders';
import { OrdersView as OrdersViewShared } from '@/src/features/orders/components/OrdersView';

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
  } = useOrders();

  return (
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
  );
}
