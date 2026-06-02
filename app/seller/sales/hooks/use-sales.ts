import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/src/store';
import { Product, Sale, OrderItem, SaleStatus } from '@/src/types';
import { CustomerState } from '../components/customer-autocomplete';
import { saveClient } from '../services/sales.service';
import { fmt } from '@/src/constants';
import { useSellerStore } from '@/app/hooks/use-seller-store';

export function useSales() {
  const { state, dispatch } = useApp();
  const { storeId, storeName } = useSellerStore();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [storeId]);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<{ product: Product; qty: number; unitMode: 'base' | 'alt' }[]>([]);
  const [customer, setCustomer] = useState<CustomerState>({ name: '', id: '', email: '', phone: '' });

  const filteredProducts = useMemo(() => {
    return myProducts.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.cat.toLowerCase().includes(search.toLowerCase())
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
    if (cart.length === 0 || !storeId) return;

    // 1. Guardar cliente si hay datos de documento
    if (customer.id.trim() && customer.name.trim()) {
      try {
        await saveClient({
          profile_id: customer.profile_id || null,
          document_number: customer.id.trim(),
          full_name: customer.name.trim(),
          email: customer.email.trim() || null,
          phone: customer.phone.trim() || null,
        });
      } catch (err) {
        console.error('Error saving client on checkout:', err);
      }
    }

    // 2. Definir estado de la venta/pedido.
    // Si el rol es 'retail', la orden/venta queda en estado 'pagado' o 'preparado' automáticamente (confirmada)
    const saleStatus: SaleStatus = state.userRole === 'retail' ? 'pagado' : 'pedido';

    const newSale: Sale = {
      id: state.sales.length + 1001,
      date: new Date().toISOString(),
      storeId: storeId,
      items: cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        qty: item.qty,
        price: item.product.retailPrice,
        unit: item.product.unit,
        emoji: item.product.emoji,
        image: item.product.image
      })),
      total,
      status: saleStatus,
      customerName: customer.name.trim() || undefined,
      customerID: customer.id.trim() || undefined,
      customerEmail: customer.email.trim() || undefined
    };

    dispatch({ type: 'ADD_SALE', sale: newSale });

    setCart([]);
    setCustomer({ name: '', id: '', email: '', phone: '' });
    setSearch('');

    dispatch({
      type: 'ADD_NOTIF',
      notif: {
        id: `sale-${Date.now()}`,
        type: 'order_new',
        title: 'Venta Registrada',
        msg: `Venta #${newSale.id} por ${fmt(total)} registrada con éxito (${state.userRole === 'retail' ? 'Confirmada' : 'Pendiente'}).`,
        time: new Date().toISOString(),
        read: false
      }
    });
  };

  const mySales = useMemo(() => {
    if (!storeId) return [];
    return state.sales.filter(s => s.storeId === storeId);
  }, [state.sales, storeId]);

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
    mySales,
    todayTotal,
    nextConsecutive: state.sales.length + 1001,
    loading: loading || !storeId,
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
