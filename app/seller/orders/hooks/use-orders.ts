import { useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Order, OrderItem } from '@/src/types';
import { useSellerStore } from '@/app/hooks/use-seller-store';

export function useOrders() {
  const { stores, storeId, storeName, selectStore } = useSellerStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'all'>('all');

  // Synchronize selectedStoreId with storeId when storeId loads,
  // default to 'all' if there are multiple stores.
  useEffect(() => {
    if (storeId) {
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

      // 1. Fetch store orders with parent order details and store name
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
              full_name,
              email,
              phone
            ),
            delivery_addresses (
              label,
              address_line,
              neighborhood,
              municipality,
              department
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
      const mappedOrders: Order[] = storeOrdersData.map((so: any) => {
        const parentOrder = so.orders;
        const buyer = parentOrder?.profiles;
        const addressObj = parentOrder?.delivery_addresses;

        const addressStr = addressObj
          ? `${addressObj.address_line ?? ''}, ${addressObj.neighborhood ?? ''}, ${addressObj.municipality ?? ''}, ${addressObj.department ?? ''}`
            .replace(/,\s*,/g, ',')
            .replace(/^,\s*|,\s*$/g, '')
          : 'Retiro en tienda';

        // Filter and map items belonging to this order's store
        const storeItems: OrderItem[] = (itemsData || [])
          .filter((item: any) => item.order_id === so.order_id && item.store_products?.store_id === so.store_id)
          .map((item: any) => ({
            id: item.id,
            name: item.catalog_name || 'Producto',
            qty: Number(item.quantity),
            price: Number(item.unit_price),
            unit: item.unit_name || 'unid',
            emoji: getEmojiForName(item.catalog_name),
          }));

        return {
          id: so.order_id,
          storeOrderId: so.id, // Store Order specific DB ID
          date: so.created_at || new Date().toISOString(),
          storeId: so.store_id,
          storeName: so.stores?.name || 'Mi Tienda',
          storeEmoji: '🏪',
          items: storeItems,
          total: Number(so.subtotal),
          status: mapDbStatusToFrontend(so.status),
          buyerId: buyer?.full_name || parentOrder?.buyer_id || 'Cliente',
          address: addressStr,
          paymentMethod: parentOrder?.payment_status === 'approved' ? 'Tarjeta (Aprobado)' : 'Pendiente de Pago',
        };
      });

      setMyOrders(mappedOrders);
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
      preparing: myOrders.filter(o => o.status === 'preparing').length,
      dispatch: myOrders.filter(o => o.status === 'on_the_way').length,
      totalToday: myOrders.filter(o => new Date(o.date).toLocaleDateString() === todayStr).length
    };
  }, [myOrders]);

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    const supabase = createSupabaseBrowserClient();
    try {
      const order = myOrders.find(o => o.id === orderId);
      if (!order || !order.storeOrderId) return;

      const dbStatus = mapFrontendStatusToDb(status);

      const { error } = await supabase
        .from('store_orders')
        .update({ status: dbStatus })
        .eq('id', order.storeOrderId);

      if (error) throw error;
      await fetchStoreOrders();
    } catch (err) {
      console.error('Error updating store order status:', err);
    }
  };

  return {
    filteredOrders,
    filterStatus,
    setFilterStatus,
    stats,
    updateOrderStatus,
    loading: loading || stores.length === 0,
    stores,
    selectedStoreId,
    setSelectedStoreId,
  };
}

function mapDbStatusToFrontend(dbStatus: string): Order['status'] {
  switch (dbStatus) {
    case 'pending': return 'pending';
    case 'confirmed':
    case 'paid':
    case 'packing':
      return 'preparing';
    case 'at_collection':
    case 'dispatched':
      return 'on_the_way';
    case 'delivered': return 'delivered';
    default: return 'cancelled';
  }
}

function mapFrontendStatusToDb(feStatus: Order['status']): string {
  switch (feStatus) {
    case 'pending': return 'pending';
    case 'preparing': return 'confirmed';
    case 'on_the_way': return 'dispatched';
    case 'delivered': return 'delivered';
    default: return 'cancelled';
  }
}

function getEmojiForName(name?: string): string {
  if (!name) return '📦';
  const n = name.toLowerCase();
  if (n.includes('tomate')) return '🍅';
  if (n.includes('limón') || n.includes('limon')) return '🍋';
  if (n.includes('zanahoria')) return '🥕';
  if (n.includes('papa')) return '🥔';
  if (n.includes('maíz') || n.includes('maiz')) return '🌽';
  if (n.includes('ají') || n.includes('aji')) return '🌶️';
  if (n.includes('ajo')) return '🧄';
  if (n.includes('cebolla')) return '🧅';
  if (n.includes('carne') || n.includes('res') || n.includes('punta')) return '🥩';
  if (n.includes('banano') || n.includes('plátano')) return '🍌';
  if (n.includes('manzana')) return '🍎';
  if (n.includes('cilantro')) return '🥬';
  return '📦';
}
