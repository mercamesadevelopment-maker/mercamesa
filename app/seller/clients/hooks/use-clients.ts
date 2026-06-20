import { useState, useEffect, useMemo } from 'react';
import { useSellerStore } from '@/app/hooks/use-seller-store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { OrderItem } from '@/src/types';

export interface ClientOrder {
  id: string; // e.g. "Físico #1001" o "Digital #12345"
  rawId: string;
  date: string;
  total: number;
  status: string;
  paymentStatus: string;
  type: 'online' | 'local';
  items: OrderItem[];
}

export interface ClientWithMetrics {
  id: string;
  full_name: string;
  document_number: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  orders: ClientOrder[];
}

export function useClients() {
  const { stores, storeId, storeName, selectStore } = useSellerStore();
  const [clients, setClients] = useState<ClientWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientWithMetrics | null>(null);

  const fetchClientsAndOrders = async () => {
    if (!storeId) return;
    const supabase = createSupabaseBrowserClient();
    try {
      setLoading(true);

      // 1. Obtener todos los clientes de la tabla 'clients'
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('full_name', { ascending: true });

      if (clientsError) throw clientsError;

      // 2. Obtener todas las órdenes de la tienda actual asociadas a clientes
      const { data: storeOrdersData, error: storeOrdersError } = await supabase
        .from('store_orders')
        .select(`
          *,
          orders!inner (
            *,
            clients (
              id
            )
          )
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (storeOrdersError) throw storeOrdersError;

      // 3. Obtener los ítems de estas órdenes para detallar productos
      let itemsData: any[] = [];
      if (storeOrdersData && storeOrdersData.length > 0) {
        const orderIds = storeOrdersData.map((x: any) => x.order_id);
        const { data: orderItems, error: itemsError } = await supabase
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
        itemsData = orderItems || [];
      }

      // 4. Mapear y agrupar las órdenes por client_id
      const ordersByClient: Record<string, ClientOrder[]> = {};

      storeOrdersData?.forEach((so: any) => {
        const parentOrder = so.orders;
        const client = parentOrder?.clients;
        if (!client?.id) return; // Si no tiene cliente asociado, omitir

        const isLocal = !parentOrder?.buyer_id;

        const storeItems: OrderItem[] = itemsData
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
        else if (so.status === 'pending') statusLabel = 'Pendiente';
        else if (so.status === 'cancelled') statusLabel = 'Cancelado';
        else if (so.status === 'returned') statusLabel = 'Devuelto';

        const clientOrder: ClientOrder = {
          id: isLocal
            ? `Físico #${parentOrder?.consecutive || so.id.substring(0, 4)}`
            : `Digital #${parentOrder?.consecutive || so.order_id.substring(0, 8)}`,
          rawId: so.order_id,
          date: so.created_at,
          total: Number(so.subtotal),
          status: statusLabel,
          paymentStatus: parentOrder?.payment_status === 'approved' ? 'Pagado' : 'Pendiente',
          type: isLocal ? 'local' : 'online',
          items: storeItems,
        };

        if (!ordersByClient[client.id]) {
          ordersByClient[client.id] = [];
        }
        ordersByClient[client.id].push(clientOrder);
      });

      // 5. Consolidar métricas para cada cliente
      const mappedClients: ClientWithMetrics[] = (clientsData || []).map((c: any) => {
        const clientOrders = ordersByClient[c.id] || [];
        const totalSpent = clientOrders.reduce((sum, o) => sum + o.total, 0);
        const lastOrderDate = clientOrders.length > 0 ? clientOrders[0].date : null;

        return {
          id: c.id,
          full_name: c.full_name,
          document_number: c.document_number,
          email: c.email,
          phone: c.phone,
          created_at: c.created_at,
          totalOrders: clientOrders.length,
          totalSpent,
          lastOrderDate,
          orders: clientOrders,
        };
      });

      setClients(mappedClients);
    } catch (err) {
      console.error('Error fetching clients and orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchClientsAndOrders();
    }
  }, [storeId]);

  // Filtrar clientes según búsqueda reactiva
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        c.document_number.includes(term) ||
        (c.phone && c.phone.includes(term))
    );
  }, [clients, searchTerm]);

  // Estadísticas globales del módulo
  const stats = useMemo(() => {
    const activeClients = clients.filter((c) => c.totalOrders > 0);
    const totalSpentInStore = activeClients.reduce((sum, c) => sum + c.totalSpent, 0);
    return {
      totalClients: clients.length,
      activeClientsCount: activeClients.length,
      totalSpentInStore,
    };
  }, [clients]);

  return {
    clients: filteredClients,
    loading: loading || !storeId,
    searchTerm,
    setSearchTerm,
    selectedClient,
    setSelectedClient,
    stats,
    storeName: storeName || 'Mi Tienda',
    stores,
    storeId,
    selectStore,
    refetch: fetchClientsAndOrders,
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
