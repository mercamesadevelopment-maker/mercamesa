import { useState, useEffect, useMemo, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Order, OrderStatus } from '@/src/types';
import { updateStoreOrderStatus } from '@/src/features/orders/services/update-order-status.service';
import { revertStoreOrderStatus } from '@/src/features/orders/services/revert-order-status.service';
import { cancelStorePart } from '@/src/features/orders/services/cancel-store-part.service';
import { toStoreOrderCard } from '@/src/features/orders/utils/store-order-card';

export function useOrders() {
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');

  // Load all active stores in the system for admin filtering
  useEffect(() => {
    const fetchAllStores = async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        if (data) {
          setStores(data);
        }
      } catch (err) {
        console.error('Error loading stores list:', err);
      }
    };

    fetchAllStores();
  }, []);

  const fetchStoreOrders = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    try {
      setLoading(true);

      // 1. Fetch store orders with parent order details, store name and status history
      let query = supabase
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
        .order('created_at', { ascending: false });

      if (selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      }

      const { data: storeOrdersData, error: storeOrdersError } = await query;

      if (storeOrdersError) throw storeOrdersError;

      if (!storeOrdersData || storeOrdersData.length === 0) {
        setMyOrders([]);
        return;
      }

      // 2. Fetch order items for these orders
      const orderIds = storeOrdersData.map((x: any) => x.order_id);
      let itemsQuery = supabase
        .from('order_items')
        .select(`
          *,
          store_products!inner (
            store_id,
            catalog_product_id
          )
        `)
        .in('order_id', orderIds);

      if (selectedStoreId !== 'all') {
        itemsQuery = itemsQuery.eq('store_products.store_id', selectedStoreId);
      }

      const { data: itemsData, error: itemsError } = await itemsQuery;

      if (itemsError) throw itemsError;

      // 3. Combine details
      // Una tarjeta por parte, con su propio id (ver toStoreOrderCard).
      const mappedOrders: Order[] = storeOrdersData.map((so: any) => toStoreOrderCard(so, itemsData || []));

      setMyOrders(mappedOrders);
    } catch (err) {
      console.error('Error loading store orders:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchStoreOrders();
  }, [fetchStoreOrders]);

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

  return {
    filteredOrders,
    filterStatus,
    setFilterStatus,
    stats,
    updateOrderStatus,
    revertOrderStatus,
    cancelPart,
    deliveryError,
    dismissDeliveryError: () => setDeliveryError(null),
    loading,
    stores,
    selectedStoreId,
    setSelectedStoreId,
  };
}
