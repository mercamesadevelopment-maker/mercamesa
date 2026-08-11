import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { OrderItem } from '@/src/types';
import { useSellerStore } from '@/app/hooks/use-seller-store';
import { formatDeliveryAddress } from '@/src/features/orders/utils/format-delivery-address';

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
  const { stores, storeId, storeName, selectStore } = useSellerStore();
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
            clients (
              full_name,
              email,
              phone,
              document_number
            ),
            delivery_address_snapshot,
            delivery_addresses (
              label,
              address_line,
              neighborhood,
              municipality,
              department
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
        const parentOrder = so.orders as any;
        const buyer = parentOrder?.profiles;
        const client = parentOrder?.clients;
        const isLocal = !parentOrder?.buyer_id;

        // La venta física no tiene dirección de envío y eso es correcto, no un
        // dato faltante: se mantiene como rama aparte.
        const addressStr = isLocal
          ? 'Venta física (Local)'
          : formatDeliveryAddress(
              parentOrder?.delivery_address_snapshot,
              parentOrder?.delivery_addresses
            );

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
          id: isLocal
            ? `Físico #${parentOrder?.consecutive || so.id.substring(0, 4)}`
            : `Digital #${parentOrder?.consecutive || so.order_id.substring(0, 8)}`,
          rawId: so.order_id,
          type: isLocal ? ('local' as const) : ('online' as const),
          customerName: isLocal
            ? (client?.full_name || 'Consumidor Final')
            : (buyer?.full_name || 'Cliente Online'),
          customerID: isLocal ? (client?.document_number || undefined) : (buyer?.phone || undefined),
          customerEmail: isLocal ? (client?.email || undefined) : (buyer?.email || undefined),
          date: so.created_at,
          items: storeItems,
          total: Number(so.subtotal),
          status: statusLabel,
          paymentStatus: parentOrder?.payment_status === 'approved' ? 'Pagado' : 'Aprobado',
          paymentMethod: isLocal ? 'Efectivo' : 'Tarjeta de Crédito',
          address: addressStr,
        };
      });

      setOnlineOrders(mapped);
    } catch (err) {
      console.error('Error fetching orders history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchOnlineOrdersHistory();
    }
  }, [storeId]);

  // Cargar ventas locales desde el estado global reactivo (vacío ya que ahora se cargan de la DB)
  const localHistoryItems = useMemo(() => {
    return [] as UnifiedHistoryItem[];
  }, []);

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
    stores,
    storeId,
    selectStore,
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
