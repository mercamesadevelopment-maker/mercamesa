import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/src/store';
import { Product, Sale, OrderItem, SaleStatus } from '@/src/types';
import { CustomerState } from '../components/customer-autocomplete';
import { saveClient } from '../services/sales.service';
import { fmt } from '@/src/constants';
import { useSellerStore } from '@/app/hooks/use-seller-store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function useSales() {
  const { state, dispatch } = useApp();
  const { stores, storeId, storeName, selectStore } = useSellerStore();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [dbSales, setDbSales] = useState<Sale[]>([]);
  const [nextConsecutive, setNextConsecutive] = useState(1001);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar ventas locales de hoy desde la base de datos
  const fetchTodayDbSales = async () => {
    if (!storeId) return;
    const supabase = createSupabaseBrowserClient();
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Query store_orders created today
      const { data: todayOrders, error } = await supabase
        .from('store_orders')
        .select(`
          *,
          orders (
            *,
            clients (
              full_name,
              email,
              phone,
              document_number
            )
          )
        `)
        .eq('store_id', storeId)
        .gte('created_at', todayStart.toISOString());

      if (error) throw error;

      if (!todayOrders || todayOrders.length === 0) {
        setDbSales([]);
        return;
      }

      // Also fetch items for these orders
      const orderIds = todayOrders.map((x: any) => x.order_id);
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

      const mapped: Sale[] = todayOrders.map((so: any) => {
        const parentOrder = so.orders as any;
        const client = parentOrder?.clients;
        
        const storeItems: OrderItem[] = (itemsData || [])
          .filter((item: any) => item.order_id === so.order_id)
          .map((item: any) => ({
            id: item.id,
            name: item.catalog_name || 'Producto',
            qty: Number(item.quantity),
            price: Number(item.unit_price),
            unit: item.unit_name || 'unid',
            emoji: '📦',
          }));

        return {
          id: parentOrder?.consecutive || 1000 + so.id.substring(0, 4),
          date: so.created_at,
          storeId: so.store_id,
          items: storeItems,
          total: Number(so.subtotal),
          status: 'pagado',
          customerName: client?.full_name || undefined,
          customerID: client?.document_number || undefined,
          customerEmail: client?.email || undefined
        };
      });

      setDbSales(mapped);
    } catch (err) {
      console.error('Error fetching today db sales:', err);
    }
  };

  // Cargar el máximo consecutivo actual
  const fetchNextConsecutive = async () => {
    const supabase = createSupabaseBrowserClient();
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('consecutive')
        .order('consecutive', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data && data.consecutive) {
        setNextConsecutive(data.consecutive + 1);
      } else {
        setNextConsecutive(1001);
      }
    } catch (err) {
      console.error('Error fetching max consecutive:', err);
    }
  };

  // Cargar productos de la tienda desde la base de datos
  useEffect(() => {
    if (!storeId) return;
    const fetchStoreProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/store-products?store_id=${storeId}`);
        if (!response.ok) throw new Error('Error al cargar productos de la tienda');
        const json = await response.json();
        
        const mapped: Product[] = (json.data || []).map((item: any) => ({
          id: item.id,
          plazaId: 1, // Default
          storeId: item.store_id,
          emoji: getEmojiForCategory(item.catalog_products?.categories?.name),
          image: item.imageSignedUrl || item.catalog_products?.image_url || '',
          name: item.catalog_products?.name || '',
          code: item.code || '',
          cat: item.catalog_products?.categories?.name || 'Varios',
          unit: item.measurement_units?.abbreviation || 'kg',
          retailPrice: Number(item.price_per_unit),
          wsPrice: Number(item.wholesale_price || item.price_per_unit * 0.8),
          ws20: Number(item.price_per_unit * 0.75),
          ws50: Number(item.price_per_unit * 0.75),
          wsMin: Number(item.wholesale_min_qty || 10),
          stock: Number(item.stock),
          minStock: Number(item.min_order_qty || 1),
          masterId: item.catalog_product_id,
          desc: item.catalog_products?.description || '',
          status: item.is_active ? 'active' : 'inactive',
        }));
        setMyProducts(mapped.filter(p => p.status === 'active'));
      } catch (err) {
        console.error('Error fetching store products in sales:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStoreProducts();
    fetchTodayDbSales();
    fetchNextConsecutive();
  }, [storeId]);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<{ product: Product; qty: number; unitMode: 'base' | 'alt' }[]>([]);
  const [customer, setCustomer] = useState<CustomerState>({ name: '', id: '', identification_type_id: '', email: '', phone: '' });

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return myProducts.filter(p =>
      p.retailPrice > 0 &&
      p.stock > 0 &&
      (p.name.toLowerCase().includes(term) ||
       p.cat.toLowerCase().includes(term) ||
       (p.code || '').toLowerCase().includes(term))
    );
  }, [myProducts, search]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1, unitMode: 'base' }];
    });
  };

  const removeFromCart = (productId: number | string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const toggleUnitMode = (productId: number | string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId && item.product.unit === 'kg') {
        return { ...item, unitMode: item.unitMode === 'base' ? 'alt' : 'base' };
      }
      return item;
    }));
  };

  const updateQtyValue = (productId: number | string, val: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const realQty = item.unitMode === 'alt' && item.product.unit === 'kg' ? val / 1000 : val;
        return { ...item, qty: Math.max(0.001, realQty) };
      }
      return item;
    }));
  };

  const total = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.retailPrice * item.qty), 0);
  }, [cart]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !storeId || isSubmitting) return;

    setIsSubmitting(true);

    // 1. Guardar cliente si hay datos de documento
    let savedClient = null;
    if (customer.id.trim() && customer.name.trim()) {
      try {
        savedClient = await saveClient({
          profile_id: customer.profile_id || null,
          document_number: customer.id.trim(),
          identification_type_id: customer.identification_type_id || null,
          full_name: customer.name.trim(),
          email: customer.email.trim() || null,
          phone: customer.phone.trim() || null,
        });
      } catch (err) {
        console.error('Error saving client on checkout:', err);
      }
    }

    // 2. Definir payload de la orden
    const client_id = savedClient?.id || null;
    const client_idempotency_key = crypto.randomUUID();

    const orderPayload = {
      order: {
        buyer_id: customer.profile_id || null,
        client_id: client_id,
        buyer_type: 'retail',
        status: 'delivered',
        payment_status: 'approved',
        delivery_fee: 0,
        client_idempotency_key: client_idempotency_key,
        notes: 'Venta física registrada en sitio'
      },
      items: cart.map(item => ({
        store_product_id: item.product.id,
        quantity: item.qty,
        catalog_name: item.product.name,
        unit_name: item.product.unit
      })),
      storeOrders: [
        {
          store_id: storeId,
          status: 'delivered',
          has_refrigerated: false,
          notes: 'Venta física'
        }
      ]
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const errorJson = await response.json();
        throw new Error(errorJson.error || 'Error al guardar la venta en la base de datos');
      }

      // Re-cargar productos de la tienda (para obtener el stock actualizado descontado por el trigger)
      const fetchStoreProducts = async () => {
        try {
          const res = await fetch(`/api/store-products?store_id=${storeId}`);
          if (res.ok) {
            const json = await res.json();
            const mapped: Product[] = (json.data || []).map((item: any) => ({
              id: item.id,
              plazaId: 1, // Default
              storeId: item.store_id,
              emoji: getEmojiForCategory(item.catalog_products?.categories?.name),
              image: item.imageSignedUrl || item.catalog_products?.image_url || '',
              name: item.catalog_products?.name || '',
              cat: item.catalog_products?.categories?.name || 'Varios',
              unit: item.measurement_units?.abbreviation || 'kg',
              retailPrice: Number(item.price_per_unit),
              wsPrice: Number(item.wholesale_price || item.price_per_unit * 0.8),
              ws20: Number(item.price_per_unit * 0.75),
              ws50: Number(item.price_per_unit * 0.75),
              wsMin: Number(item.wholesale_min_qty || 10),
              stock: Number(item.stock),
              minStock: Number(item.min_order_qty || 1),
              masterId: item.catalog_product_id,
              desc: item.catalog_products?.description || '',
              status: item.is_active ? 'active' : 'inactive',
            }));
            setMyProducts(mapped.filter(p => p.status === 'active'));
          }
        } catch (err) {
          console.error('Error refreshing products stock:', err);
        }
      };
      await fetchStoreProducts();
      await fetchTodayDbSales();
      await fetchNextConsecutive();

      setCart([]);
      setCustomer({ name: '', id: '', identification_type_id: '', email: '', phone: '' });
      setSearch('');

      dispatch({
        type: 'ADD_NOTIF',
        notif: {
          id: `sale-${Date.now()}`,
          type: 'order_new',
          title: 'Venta Registrada',
          msg: `Venta física por ${fmt(total)} registrada con éxito en la base de datos.`,
          time: new Date().toISOString(),
          read: false
        }
      });
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al guardar la venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const mySales = dbSales;

  const todayTotal = useMemo(() => {
    return mySales.reduce((acc, s) => acc + s.total, 0);
  }, [mySales]);

  return {
    search,
    setSearch,
    cart,
    setCart,
    customer,
    setCustomer,
    filteredProducts,
    addToCart,
    removeFromCart,
    toggleUnitMode,
    updateQtyValue,
    total,
    handleCheckout,
    isSubmitting,
    mySales,
    todayTotal,
    nextConsecutive,
    loading: loading || !storeId,
    stores,
    storeId,
    storeName,
    selectStore,
  };
}

function getEmojiForCategory(catName?: string): string {
  if (!catName) return '📦';
  const name = catName.toLowerCase();
  if (name.includes('fruta')) return '🍋';
  if (name.includes('verdura') || name.includes('hortaliza')) return '🍅';
  if (name.includes('especias') || name.includes('ají') || name.includes('ajo')) return '🧄';
  if (name.includes('granos') || name.includes('arroz') || name.includes('maíz')) return '🌽';
  if (name.includes('carne') || name.includes('embutido')) return '🥩';
  if (name.includes('lácteo')) return '🥛';
  return '📦';
}
