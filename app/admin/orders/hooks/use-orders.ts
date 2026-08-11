import { useState, useEffect, useMemo, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Order, OrderItem, OrderStatus, OrderStatusHistoryItem } from '@/src/types';
import { updateStoreOrderStatus } from '@/src/features/orders/services/update-order-status.service';
import { formatDeliveryAddress } from '@/src/features/orders/utils/format-delivery-address';

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
              department
            )
          ),
          store_order_status_history (
            id,
            status,
            notes,
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
      const mappedOrders: Order[] = storeOrdersData.map((so: any) => {
        const parentOrder = so.orders;
        const buyer = parentOrder?.profiles;
        const addressStr = formatDeliveryAddress(
          parentOrder?.delivery_address_snapshot,
          parentOrder?.delivery_addresses
        );

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

        const client = (buyer?.clients && Array.isArray(buyer.clients) && buyer.clients.length > 0)
          ? buyer.clients[0]
          : null;

        const historyData: OrderStatusHistoryItem[] = (so.store_order_status_history || [])
          .map((h: any) => ({
            id: h.id,
            status: h.status as OrderStatus,
            notes: h.notes,
            createdAt: h.created_at,
            changedByName: h.profiles?.full_name || null,
          }))
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        return {
          id: so.order_id,
          storeOrderId: so.id, // Store Order specific DB ID
          date: so.created_at || new Date().toISOString(),
          storeId: so.store_id,
          storeName: so.stores?.name || 'Mi Tienda',
          storeEmoji: '🏪',
          items: storeItems,
          total: Number(so.subtotal),
          status: so.status as OrderStatus,
          buyerId: buyer?.full_name || parentOrder?.buyer_id || 'Cliente',
          address: addressStr,
          paymentMethod: parentOrder?.payment_status === 'approved' ? 'Tarjeta (Aprobado)' : 'Pendiente de Pago',
          buyerName: client?.full_name || buyer?.full_name || 'Cliente',
          buyerPhone: client?.phone || buyer?.phone || null,
          buyerEmail: client?.email || buyer?.email || null,
          buyerDocument: client?.document_number || buyer?.document_number || null,
          notes: so.notes || parentOrder?.notes || null,
          paymentStatus: parentOrder?.payment_status || 'pending',
          discount: parentOrder?.discount ? Number(parentOrder.discount) : 0,
          deliveryFee: parentOrder?.delivery_fee ? Number(parentOrder.delivery_fee) : 0,
          subtotal: Number(so.subtotal),
          history: historyData,
        };
      });

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

  const updateOrderStatus = async (orderId: string, status: OrderStatus, notes?: string) => {
    try {
      const order = myOrders.find(o => o.id === orderId);
      if (!order || !order.storeOrderId) return;

      await updateStoreOrderStatus(order.storeOrderId, status, notes);
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
    loading,
    stores,
    selectedStoreId,
    setSelectedStoreId,
  };
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
