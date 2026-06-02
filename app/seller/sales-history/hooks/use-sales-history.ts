import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { OrderItem } from '@/src/types';
import { useSellerStore } from '@/app/hooks/use-seller-store';

export interface UnifiedHistoryItem {
  id: string; // e.g. "Digital #MM-1234" or "Físico #1001"
  rawId: string | number;
  type: 'online' | 'local';
  customerName: string;
  customerID?: string;
  customerEmail?: string;
  date: string;
  items: OrderItem[];
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  address?: string;
}

export function useSalesHistory() {
  const { state } = useApp();
  const { storeId, storeName } = useSellerStore();
  const [onlineOrders, setOnlineOrders] = useState<UnifiedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<UnifiedHistoryItem | null>(null);

  // Cargar pedidos online históricos de la base de datos
  const fetchOnlineOrdersHistory = async () => {
    if (!storeId) return;
    const supabase = createSupabaseBrowserClient();
    try {
      setLoading(true);

      // Cargar store_orders completados/confirmados (todos menos pending y cancelled/returned)
      const { data: storeOrdersData, error: storeOrdersError } = await supabase
        .from('store_orders')
        .select(`
          *,
          orders (
            *,
            profiles (
              full_name,
              email,
              phone
            ),
            delivery_addresses (
              street,
              neighborhood,
              city,
              notes
            )
          )
        `)
        .eq('store_id', storeId)
        .neq('status', 'pending')
        .neq('status', 'cancelled')
        .neq('status', 'returned')
        .order('created_at', { ascending: false });

      if (storeOrdersError) throw storeOrdersError;

      if (!storeOrdersData || storeOrdersData.length === 0) {
        setOnlineOrders([]);
        return;
      }

      // Cargar ítems
      const orderIds = storeOrdersData.map((x: any) => x.order_id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          store_products!inner (
            store_id
          )
        `)
        .in('order_id', orderIds)
        .eq('store_products.store_id', storeId);

      if (itemsError) throw itemsError;

      const mapped: UnifiedHistoryItem[] = storeOrdersData.map((so: any) => {
        const parentOrder = so.orders;
        const buyer = parentOrder?.profiles;
        const addressObj = parentOrder?.delivery_addresses;

        const addressStr = addressObj 
          ? `${addressObj.street}, ${addressObj.neighborhood}, ${addressObj.city}` 
          : 'Retiro en tienda';

        const storeItems: OrderItem[] = (itemsData || [])
          .filter((item: any) => item.order_id === so.order_id)
          .map((item: any) => ({
            id: item.id,
            name: item.catalog_name || 'Producto',
            qty: Number(item.quantity),
            price: Number(item.unit_price),
            unit: item.unit_name || 'unid',
            emoji: getEmojiForName(item.catalog_name),
          }));

        let statusLabel = 'Confirmado';
        if (so.status === 'delivered') statusLabel = 'Entregado';

        return {
          id: `Digital #${so.order_id.substring(0, 8)}`,
          rawId: so.order_id,
          type: 'online',
          customerName: buyer?.full_name || 'Cliente Online',
          customerID: buyer?.phone || undefined,
          customerEmail: buyer?.email || undefined,
          date: so.created_at,
          items: storeItems,
          total: Number(so.subtotal),
          status: statusLabel,
          paymentStatus: parentOrder?.payment_status === 'approved' ? 'Pagado' : 'Aprobado',
          paymentMethod: 'Tarjeta de Crédito',
          address: addressStr,
        };
      });

      setOnlineOrders(mapped);
    } catch (err) {
      console.error('Error fetching online orders history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchOnlineOrdersHistory();
    }
  }, [storeId]);

  // Cargar ventas locales desde el estado global reactivo (ventas registradas en sitio)
  const localHistoryItems = useMemo(() => {
    if (!storeId) return [];
    return state.sales
      .filter(s => s.storeId === storeId && (s.status === 'pagado' || s.status === 'entregado' || s.status === 'preparado'))
      .map(s => {
        let statusLabel = 'Confirmado';
        if (s.status === 'entregado') statusLabel = 'Entregado';
        else if (s.status === 'pagado') statusLabel = 'Pagado';

        return {
          id: `Físico #${s.id}`,
          rawId: s.id,
          type: 'local' as const,
          customerName: s.customerName || 'Consumidor Final',
          customerID: s.customerID,
          customerEmail: s.customerEmail,
          date: s.date,
          items: s.items,
          total: s.total,
          status: statusLabel,
          paymentStatus: s.status === 'pagado' ? 'Pagado' : 'Aprobado',
          paymentMethod: 'Efectivo',
        };
      });
  }, [state.sales, storeId]);

  // Unificación de colecciones
  const unifiedHistory = useMemo(() => {
    return [...onlineOrders, ...localHistoryItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [onlineOrders, localHistoryItems]);

  const totalHistoricalRevenue = useMemo(() => {
    return unifiedHistory.reduce((acc, item) => acc + item.total, 0);
  }, [unifiedHistory]);

  return {
    unifiedHistory,
    selectedItem,
    setSelectedItem,
    totalHistoricalRevenue,
    storeName: storeName || 'Mi Tienda',
    loading: loading || !storeId,
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
