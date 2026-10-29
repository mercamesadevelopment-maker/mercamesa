import { useState, useEffect, useMemo, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Order, OrderStatus } from '@/features/orders/types/order.types';
import { useSellerStore } from '@/app/seller/hooks/use-seller-store';
import { updateStoreOrderStatus } from '@/features/orders/services/update-order-status.service';
import { revertStoreOrderStatus } from '@/features/orders/services/revert-order-status.service';
import { cancelStorePart } from '@/features/orders/services/cancel-store-part.service';
import { savePackingNotes } from '@/features/orders/services/packing-notes.service';
import { toStoreOrderCard } from '@/features/orders/utils/store-order-card';
import { isPaymentApproved } from '@/features/orders/utils/payment-status';

export function useOrders() {
  const { stores, storeId, storeName, selectStore } = useSellerStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');

  // Synchronize selectedStoreId with storeId once storeId first loads,
  // default to 'all' if there are multiple stores.
  //
  // Solo debe correr una vez: el efecto de abajo sincroniza selectedStoreId
  // hacia storeId global, y si este efecto también reaccionara a cada cambio
  // de storeId entraría en bucle, deshaciendo la selección del vendedor
  // apenas la elegía.
  const didInitStoreFilter = useRef(false);
  useEffect(() => {
    if (storeId && !didInitStoreFilter.current) {
      didInitStoreFilter.current = true;
      if (stores.length > 1) {
        setSelectedStoreId('all');
      } else {
        setSelectedStoreId(storeId);
      }
    }
  }, [storeId, stores]);

  // Sync back selectedStoreId to the global useSellerStore if it's a specific store
  useEffect(() => {
    if (selectedStoreId && selectedStoreId !== 'all' && selectedStoreId !== storeId) {
      selectStore(selectedStoreId);
    }
  }, [selectedStoreId, storeId, selectStore]);

  const fetchStoreOrders = async () => {
    if (stores.length === 0) return;

    // Determine the store IDs to query based on selectedStoreId filter
    const storeIdsToQuery = selectedStoreId === 'all'
      ? stores.map(s => s.id)
      : [selectedStoreId];

    const supabase = createSupabaseBrowserClient();
    try {
      setLoading(true);

      // 1. Fetch store orders with parent order details, store name and status history
      const { data: storeOrdersData, error: storeOrdersError } = await supabase
        .from('store_orders')
        .select(`
          *,
          stores (
            name
          ),
          orders (
            *,
            profiles (
              id,
              full_name,
              email,
              phone,
              document_number,
              clients (
                document_number,
                full_name,
                email,
                phone
              )
            ),
            delivery_address_snapshot,
            delivery_addresses (
              label,
              address_line,
              neighborhood,
              municipality,
              department,
              delivery_instructions
            )
          ),
          store_order_status_history (
            id,
            status,
            notes,
            is_reversal,
            created_at,
            profiles:changed_by (
              full_name
            )
          )
        `)
        .in('store_id', storeIdsToQuery)
        .order('created_at', { ascending: false });

      if (storeOrdersError) throw storeOrdersError;

      if (!storeOrdersData || storeOrdersData.length === 0) {
        setMyOrders([]);
        return;
      }

      // 2. Fetch order items for these orders
      const orderIds = storeOrdersData.map((x: any) => x.order_id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          store_products!inner (
            store_id,
            catalog_product_id
          )
        `)
        .in('order_id', orderIds)
        .in('store_products.store_id', storeIdsToQuery);

      if (itemsError) throw itemsError;

      // 3. Combine details
      // Una tarjeta por parte, con su propio id (ver toStoreOrderCard).
      const mappedOrders: Order[] = storeOrdersData.map((so: any) => toStoreOrderCard(so, itemsData || []));

      // Solo los pedidos con el pago aprobado. Uno sin pagar no es trabajo del
      // tendero todavía: puede no pagarse nunca, y al vencerse queda cancelado
      // sin que la tienda haya hecho nada. Antes aparecían los dos —los
      // pendientes de pago y los que el cliente dejó vencer—, mezclados con los
      // que sí hay que despachar. Al aprobarse el pago, el pedido entra solo y
      // ya en «Confirmado».
      setMyOrders(mappedOrders.filter((o) => isPaymentApproved(o.paymentStatus)));
    } catch (err) {
      console.error('Error loading store orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stores.length > 0) {
      fetchStoreOrders();
    }
  }, [stores, selectedStoreId]);

  const filteredOrders = useMemo(() => {
    return myOrders.filter(o => filterStatus === 'all' || o.status === filterStatus);
  }, [myOrders, filterStatus]);

  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    return {
      pending: myOrders.filter(o => o.status === 'pending').length,
      confirmed: myOrders.filter(o => o.status === 'confirmed').length,
      paid: myOrders.filter(o => o.status === 'paid').length,
      packing: myOrders.filter(o => o.status === 'packing').length,
      at_collection: myOrders.filter(o => o.status === 'at_collection').length,
      dispatched: myOrders.filter(o => o.status === 'dispatched').length,
      delivered: myOrders.filter(o => o.status === 'delivered').length,
      cancelled: myOrders.filter(o => o.status === 'cancelled').length,
      returned: myOrders.filter(o => o.status === 'returned').length,
      totalToday: myOrders.filter(o => new Date(o.date).toLocaleDateString() === todayStr).length
    };
  }, [myOrders]);

  // Si el domicilio no se pudo pedir, el cambio de estado igual queda guardado,
  // pero el vendedor tiene que enterarse: antes fallaba en silencio y el pedido
  // parecía despachado sin que hubiera mensajero en camino.
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const updateOrderStatus = async (orderId: string, status: OrderStatus, notes?: string) => {
    try {
      const order = myOrders.find(o => o.id === orderId);
      if (!order || !order.storeOrderId) return;

      const outcome = await updateStoreOrderStatus(order.storeOrderId, status, notes);
      if (outcome.error) setDeliveryError(outcome.error);

      await fetchStoreOrders();
    } catch (err) {
      console.error('Error updating store order status:', err);
    }
  };

  // Corrección manual a un estado anterior. A diferencia de updateOrderStatus, el
  // error se propaga: el modal tiene que mostrar por qué la base lo rechazó.
  const revertOrderStatus = async (orderId: string, status: OrderStatus, notes: string) => {
    const order = myOrders.find(o => o.id === orderId);
    if (!order?.storeOrderId) throw new Error('No se encontró el pedido.');

    await revertStoreOrderStatus(order.storeOrderId, status, notes);
    await fetchStoreOrders();
  };

  // La tienda no puede cumplir su parte de un pedido de varias tiendas. El error
  // se propaga: el modal muestra por qué no se pudo.
  const cancelPart = async (orderId: string, reason: string) => {
    const order = myOrders.find(o => o.id === orderId);
    if (!order?.storeOrderId) throw new Error('No se encontró el pedido.');

    await cancelStorePart(order.storeOrderId, reason);
    await fetchStoreOrders();
  };

  /** Cómo va empacada la parte. Actualiza la lista sin volver a cargarla. */
  const updatePackingNotes = async (orderId: string, notes: string) => {
    const order = myOrders.find(o => o.id === orderId);
    if (!order?.storeOrderId) throw new Error('No se encontró el pedido.');

    const guardada = await savePackingNotes(String(order.storeOrderId), notes);
    setMyOrders(prev => prev.map(o => (o.id === orderId ? { ...o, packingNotes: guardada } : o)));
  };

  return {
    filteredOrders,
    filterStatus,
    setFilterStatus,
    stats,
    updateOrderStatus,
    revertOrderStatus,
    cancelPart,
    updatePackingNotes,
    deliveryError,
    dismissDeliveryError: () => setDeliveryError(null),
    loading: loading || stores.length === 0,
    stores,
    selectedStoreId,
    setSelectedStoreId,
  };
}
