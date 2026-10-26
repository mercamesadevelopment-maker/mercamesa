import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { Product, Order, Plaza, Store, Offer, MasterProduct } from '../types';
import { fmt, WEEK_DATA, CAT_DATA } from '../constants';
import { formatOrderCode } from '@/lib/orders/order-code';
import { Button, Badge, Input, cn } from './Shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend, Line, ComposedChart
} from 'recharts';
import {
  TrendingUp, Package, ShoppingBag, Star, Plus, Edit2, Trash2, Filter, ChevronRight, Send, Smile, Phone, MoreVertical, CheckCircle2, AlertCircle, MapPin, Building2, User, X, Zap, Info, MessageSquare, Store as StoreIcon, Image as ImageIcon, Tag, ClipboardList, BrainCircuit, ArrowUpRight, Leaf, User2, CreditCard, Receipt
} from 'lucide-react';

export function WhatsAppBot() {
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState([
    { id: 1, text: "¡Hola! Soy el bot de MercaMesa. 🌿", sender: 'bot', time: '10:00 AM' },
    { id: 2, text: "Puedes usar comandos para actualizar tu tienda:\n• /precio [producto] [valor]\n• /stock [producto] [cantidad]\n• lista\n• pedidos", sender: 'bot', time: '10:00 AM' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), text: input, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages([...messages, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let response = "No entiendo ese comando. Escribe 'ayuda' para ver la lista.";
      const text = input.toLowerCase();

      if (text.startsWith('/precio')) {
        const parts = text.split(' ');
        if (parts.length >= 3) {
          const name = parts.slice(1, -1).join(' ');
          const price = parseInt(parts[parts.length - 1]);
          const prod = state.products.find(p => p.name.toLowerCase().includes(name));
          if (prod) {
            dispatch({ type: 'UPDATE_PRODUCT', product: { ...prod, retailPrice: price } });
            response = `✅ Precio de ${prod.name} actualizado a ${fmt(price)}.`;
          } else {
            response = `❌ No encontré el producto "${name}".`;
          }
        }
      } else if (text.startsWith('/stock')) {
        const parts = text.split(' ');
        if (parts.length >= 3) {
          const name = parts.slice(1, -1).join(' ');
          const stock = parseInt(parts[parts.length - 1]);
          const prod = state.products.find(p => p.name.toLowerCase().includes(name));
          if (prod) {
            dispatch({ type: 'UPDATE_PRODUCT', product: { ...prod, stock } });
            response = `✅ Stock de ${prod.name} actualizado a ${stock} ${prod.unit}s.`;
          } else {
            response = `❌ No encontré el producto "${name}".`;
          }
        }
      } else if (text === 'lista') {
        response = "Tus productos:\n" + state.products.filter(p => p.storeId === state.stores[0].id).map(p => `• ${p.name}: ${fmt(p.retailPrice)} (${p.stock} disp.)`).join('\n');
      } else if (text === 'pedidos') {
        response = "Tienes 4 pedidos pendientes hoy.";
      } else if (text === 'ayuda') {
        response = "Comandos:\n• /precio [producto] [valor]\n• /stock [producto] [cantidad]\n• lista\n• pedidos";
      }

      const botMsg = { id: Date.now() + 1, text: response, sender: 'bot', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      <div className="bg-[#075E54] p-6 rounded-t-[32px] shadow-sm flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold">MercaMesa Bot</h2>
            <p className="text-xs text-white/70 font-bold flex items-center gap-1">
              {isTyping ? 'escribiendo...' : 'En línea'}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <Phone className="w-5 h-5" />
          <MoreVertical className="w-5 h-5" />
        </div>
      </div>

      <div className="flex-grow bg-[#E5DDD5] border-x border-mm-crd overflow-y-auto p-6 space-y-4 scrollbar-hide relative">
        {/* WhatsApp background pattern simulation */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }} />

        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn(
              "max-w-[85%] p-3 rounded-xl text-sm shadow-sm relative z-10 whitespace-pre-wrap",
              msg.sender === 'user'
                ? "bg-[#DCF8C6] text-[#303030] ml-auto rounded-tr-none"
                : "bg-white text-[#303030] mr-auto rounded-tl-none"
            )}
          >
            {msg.text}
            <span className="block text-[10px] mt-1 opacity-50 text-right">{msg.time}</span>
          </motion.div>
        ))}
      </div>

      <div className="bg-[#F0F0F0] p-4 rounded-b-[32px] shadow-sm">
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
          {["lista", "pedidos", "/precio Tomate 2800", "/stock Limón 50", "ayuda"].map(chip => (
            <button
              key={chip}
              onClick={() => setInput(chip)}
              className="px-4 py-1.5 bg-white text-mm-txs text-xs font-bold rounded-full whitespace-nowrap hover:bg-mm-gll transition-colors shadow-sm"
            >
              {chip}
            </button>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-3">
          <button type="button" className="p-3 text-mm-txw hover:text-mm-g transition-colors"><Smile className="w-6 h-6" /></button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un comando..."
            className="flex-grow bg-white rounded-full px-6 py-3 text-sm outline-none shadow-sm"
          />
          <button
            type="submit"
            className="w-12 h-12 bg-[#128C7E] text-white rounded-full flex items-center justify-center hover:bg-[#075E54] transition-all shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

const pathToTab: Record<string, string> = {
  '/admin/marketplaces': 'plazas',
  '/admin/stores': 'stores',
  '/admin/products': 'products',
  '/admin/catalog': 'catalog',
  '/admin/offers': 'offers',
  '/admin/orders': 'orders',
  '/admin/reputation': 'reputation',
  '/admin/projections': 'projections',
  '/admin/analytics': 'analytics',
  '/admin/notifications': 'notifs',
};

const tabToRoute: Record<string, string> = {
  plazas: '/admin/marketplaces',
  stores: '/admin/stores',
  products: '/admin/products',
  catalog: '/admin/catalog',
  offers: '/admin/offers',
  orders: '/admin/orders',
  reputation: '/admin/reputation',
  projections: '/admin/projections',
  analytics: '/admin/analytics',
  notifs: '/admin/notifications',
};

export function AdminView() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(pathToTab[pathname] || 'plazas');
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);
  const [isAddPlazaOpen, setIsAddPlazaOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddOfferOpen, setIsAddOfferOpen] = useState(false);
  const [isAddCatalogOpen, setIsAddCatalogOpen] = useState(false);

  const [newStore, setNewStore] = useState({
    name: '', local: '', plazaId: 1, emoji: '🏪', cat: 'Varios', image: '',
    openTime: '06:00', closeTime: '18:00', lat: 0, lng: 0, website: '', email: '', phone: ''
  });
  const [newPlaza, setNewPlaza] = useState({
    name: '', city: '', address: '', emoji: '🏛️', bg: '#EEF2E8', image: '',
    openTime: '06:00', closeTime: '18:00', lat: 0, lng: 0, website: '', email: '', phone: ''
  });
  const [newProduct, setNewProduct] = useState({ name: '', storeId: 1 as number | string, retailPrice: 0, stock: 0, unit: 'kg', emoji: '🍎', cat: 'Varios', image: '', masterId: 0 as any });
  const [newOffer, setNewOffer] = useState({ title: '', desc: '', type: 'percentage' as 'percentage' | 'fixed', value: 0, productIds: [] as (number | string)[], emoji: '🏷️', storeId: 1 as number | string, image: '' });
  const [newCatalogItem, setNewCatalogItem] = useState({ name: '', cat: 'Varios', emoji: '📦', image: '', defaultUnit: 'kg' });
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [filterStoreId, setFilterStoreId] = useState<number | string | 'all'>('all');
  const [stockStoreDetail, setStockStoreDetail] = useState<number | string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const isProvider = state.userRole === 'provider';
  const isSuperAdmin = state.buyerProfile.email === 'info@pq-scem.com';

  const totalRevenue = state.orders.reduce((acc, o) => acc + o.total, 0);
  const activeOrders = state.orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'on_the_way').length;

  const tabs = [
    { id: 'plazas', label: 'Plazas', icon: Building2 },
    { id: 'stores', label: 'Tiendas', icon: StoreIcon },
    { id: 'products', label: 'Productos', icon: ShoppingBag },
    { id: 'catalog', label: 'Catálogo', icon: ClipboardList },
    { id: 'offers', label: 'Ofertas', icon: Tag },
    { id: 'orders', label: 'Pedidos', icon: Package },
    { id: 'reputation', label: 'Reputación', icon: Star },
    { id: 'projections', label: 'Proyecciones', icon: BrainCircuit },
    { id: 'analytics', label: 'Analítica', icon: TrendingUp },
  ];

  const TAB_GROUPS = [
    { label: 'Ecosistema', items: ['plazas', 'stores', 'reputation'] },
    { label: 'Catálogo', items: ['catalog', 'products'] },
    { label: 'Operativo', items: ['orders', 'offers'] },
    { label: 'Inteligencia', items: ['analytics', 'projections'] }
  ];

  const filteredTabs = (isProvider && !isSuperAdmin) ? [
    tabs.find(t => t.id === 'analytics')!,
    tabs.find(t => t.id === 'offers')!,
    tabs.find(t => t.id === 'reputation')!
  ] : tabs;

  useEffect(() => {
    const tab = pathToTab[pathname];
    if (tab && tabs.some(t => t.id === tab)) {
      setActiveTab(tab);
      if (tab === 'reputation') setFilterStoreId('all');
    }
  }, [pathname]);

  const handleTabChange = (tabId: string) => {
    const route = tabToRoute[tabId] || `/${tabId}`;
    router.push(route);
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlazaImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPlaza(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStoreImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewStore(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOfferImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewOffer(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCatalogImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCatalogItem(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPlaza = (e: React.FormEvent) => {
    e.preventDefault();
    const plaza: Plaza = {
      id: state.plazas.length + 1,
      name: newPlaza.name,
      city: newPlaza.city,
      address: newPlaza.address,
      emoji: newPlaza.emoji,
      image: newPlaza.image || undefined,
      bg: newPlaza.bg,
      rating: 5.0,
      stores: 0,
      open: true,
      tags: ['Nuevo'],
      status: 'active',
      openTime: newPlaza.openTime,
      closeTime: newPlaza.closeTime,
      phone: newPlaza.phone,
      location: { lat: Number(newPlaza.lat), lng: Number(newPlaza.lng) },
      website: newPlaza.website,
      email: newPlaza.email
    };
    dispatch({ type: 'ADD_PLAZA', plaza });
    setIsAddPlazaOpen(false);
    setNewPlaza({
      name: '', city: '', address: '', emoji: '🏛️', bg: '#EEF2E8', image: '',
      openTime: '06:00', closeTime: '18:00', lat: 0, lng: 0, website: '', email: '', phone: ''
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const store = state.stores.find(s => s.id === Number(newProduct.storeId));
    const master = state.catalog.find(i => i.id === newProduct.masterId);
    const product: Product = {
      id: state.products.length + 1,
      name: newProduct.name,
      storeId: Number(newProduct.storeId),
      plazaId: store?.plazaId || 1,
      retailPrice: Number(newProduct.retailPrice),
      wsPrice: Math.floor(Number(newProduct.retailPrice) * 0.8),
      ws20: Math.floor(Number(newProduct.retailPrice) * 0.75),
      ws50: Math.floor(Number(newProduct.retailPrice) * 0.7),
      wsMin: 10,
      stock: Number(newProduct.stock),
      minStock: 10,
      unit: newProduct.unit,
      emoji: master?.emoji || '📦',
      image: newProduct.image,
      cat: newProduct.cat,
      desc: 'Nuevo producto en MercaMesa',
      status: 'active'
    };
    dispatch({ type: 'ADD_PRODUCT', product });
    setIsAddProductOpen(false);
    setNewProduct({ name: '', storeId: 1, retailPrice: 0, stock: 0, unit: 'kg', emoji: '🍎', cat: 'Varios', image: '', masterId: 0 });
  };

  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault();
    const store: Store = {
      id: state.stores.length + 1,
      name: newStore.name,
      local: newStore.local,
      plazaId: Number(newStore.plazaId),
      emoji: newStore.emoji,
      image: newStore.image || undefined,
      cat: newStore.cat,
      rating: 5.0,
      reviewCount: 0,
      desc: 'Nueva tienda en MercaMesa',
      ownerName: 'Nuevo Dueño',
      open: true,
      status: 'active',
      openTime: newStore.openTime,
      closeTime: newStore.closeTime,
      phone: newStore.phone,
      location: { lat: Number(newStore.lat), lng: Number(newStore.lng) },
      website: newStore.website,
      email: newStore.email
    };
    dispatch({ type: 'ADD_STORE', store });
    setIsAddStoreOpen(false);
    setNewStore({
      name: '', local: '', plazaId: 1, emoji: '🏪', cat: 'Varios', image: '',
      openTime: '06:00', closeTime: '18:00', lat: 0, lng: 0, website: '', email: '', phone: ''
    });
  };

  const handleAddOffer = (e: React.FormEvent) => {
    e.preventDefault();
    const store = state.stores.find(s => s.id === Number(newOffer.storeId));
    const offer: Offer = {
      id: state.offers.length + 1,
      title: newOffer.title,
      desc: newOffer.desc,
      type: newOffer.type,
      value: Number(newOffer.value),
      productIds: newOffer.productIds,
      storeId: Number(newOffer.storeId),
      plazaId: store?.plazaId || 1,
      status: 'active',
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      emoji: newOffer.emoji,
      image: newOffer.image
    };
    dispatch({ type: 'ADD_OFFER', offer });
    setIsAddOfferOpen(false);
    setNewOffer({ title: '', desc: '', type: 'percentage', value: 0, productIds: [], emoji: '🏷️', storeId: 1, image: '' });
  };

  const handleAddCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    const item: MasterProduct = {
      id: state.catalog.length + 1,
      ...newCatalogItem
    };
    dispatch({ type: 'ADD_CATALOG_ITEM', item });
    setIsAddCatalogOpen(false);
    setNewCatalogItem({ name: '', cat: 'Varios', emoji: '📦', image: '', defaultUnit: 'kg' });
  };

  const groupedProducts = useMemo(() => {
    const groups: Record<string, {
      id: string;
      masterId?: number | string;
      name: string;
      cat: string;
      unit: string;
      image?: string;
      emoji: string;
      items: Product[];
      totalStock: number;
      avgPrice: number;
    }> = {};

    state.products.forEach(p => {
      // Grouping by masterId if available, fallback to name
      const key = p.masterId ? `m_${p.masterId}` : `n_${p.name}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          masterId: p.masterId,
          name: p.name,
          cat: p.cat,
          unit: p.unit,
          image: p.image,
          emoji: p.emoji,
          items: [],
          totalStock: 0,
          avgPrice: 0
        };
      }
      groups[key].items.push(p);
      groups[key].totalStock += p.stock;
    });

    Object.values(groups).forEach(group => {
      if (group.items.length > 0) {
        group.avgPrice = group.items.reduce((acc, item) => acc + item.retailPrice, 0) / group.items.length;
      }
    });

    return Object.values(groups);
  }, [state.products]);

  const stockAnalyticsData = useMemo(() => {
    const pNames = Array.from(new Set(state.products.map(p => p.name)));
    const data = pNames.map(name => {
      const row: any = { name };
      let total = 0;
      state.products.filter(p => p.name === name).forEach(p => {
        const store = state.stores.find(s => s.id === p.storeId);
        if (store) {
          row[store.name] = p.stock;
          total += p.stock;
        }
      });
      row.total = total;
      return row;
    });
    return data.sort((a, b) => b.total - a.total).slice(0, 8);
  }, [state.products, state.stores]);

  const uniqueStoreNames = useMemo(() => {
    return Array.from(new Set(state.stores.map(s => s.name)));
  }, [state.stores]);

  const globalStockData = useMemo(() => {
    const pNames = Array.from(new Set(state.products.map(p => p.name)));
    return pNames.map(name => {
      const total = state.products
        .filter(p => p.name === name)
        .reduce((acc, p) => acc + p.stock, 0);
      return { name, total };
    }).sort((a, b) => b.total - a.total);
  }, [state.products]);

  const storeStockSummary = useMemo(() => {
    return state.stores.map(s => {
      const storeProducts = state.products.filter(p => p.storeId === s.id);
      const totalStock = storeProducts.reduce((acc, p) => acc + p.stock, 0);
      const lowStockCount = storeProducts.filter(p => p.stock < p.minStock).length;
      const totalValue = storeProducts.reduce((acc, p) => acc + (p.stock * (p.wsPrice || p.retailPrice)), 0);

      return {
        id: s.id,
        name: s.name,
        plazaPath: s.plazaId === 1 ? 'Paloquemao' : (s.plazaId === 2 ? 'Corabastos' : '7 de Agosto'),
        itemCount: storeProducts.length,
        totalStock,
        totalValue,
        lowStockCount,
        rating: s.rating,
        products: storeProducts
      };
    }).sort((a, b) => b.totalStock - a.totalStock);
  }, [state.stores, state.products]);

  const chartPalette = ['#4C7A5E', '#E8734A', '#B9502A', '#3A5248', '#6A7C74', '#C3F03F'];

  const projectionData = useMemo(() => {
    // Fake projection data based on historical trends
    const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    const nextDays = ['Próx. Lun', 'Próx. Mar', 'Próx. Mie'];

    return [
      ...days.map((day, i) => ({
        name: day,
        actual: 400 + Math.random() * 200 + i * 50,
        projected: 400 + Math.random() * 200 + i * 50,
        type: 'historical'
      })),
      ...nextDays.map((day, i) => ({
        name: day,
        projected: 800 + Math.random() * 300 + i * 100,
        type: 'future'
      }))
    ];
  }, []);

  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Top Menu - Full Width */}
      {(!isProvider || isSuperAdmin) && (
        <div className={cn(
          "w-full overflow-x-auto scrollbar-hide pb-2 md:pb-0",
          isSuperAdmin ? "flex flex-wrap gap-4" : "flex bg-white p-1 rounded-2xl border border-mm-crd shadow-sm self-start w-fit"
        )}>
          {isSuperAdmin ? (
            TAB_GROUPS.map(group => (
              <div key={group.label} className="bg-white/80 backdrop-blur-sm p-1.5 rounded-[24px] border border-mm-crd shadow-sm flex items-center gap-1 shrink-0">
                <div className="px-3 py-1 border-r border-mm-crd pr-4 mr-1 hidden sm:block">
                  <p className="text-[9px] uppercase font-black text-mm-txw tracking-tighter leading-none">{group.label}</p>
                </div>
                <div className="flex gap-1">
                  {group.items.map(tabId => {
                    const tab = tabs.find(t => t.id === tabId);
                    if (!tab) return null;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={cn(
                          "px-4 py-2 rounded-[18px] text-[11px] font-bold transition-all flex items-center gap-2 shrink-0 whitespace-nowrap",
                          activeTab === tab.id ? "bg-mm-g text-white shadow-lg scale-105" : "text-mm-txs hover:bg-mm-gbg"
                        )}
                      >
                        <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            filteredTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                  activeTab === tab.id ? "bg-mm-g text-white shadow-md" : "text-mm-txs hover:bg-mm-gbg"
                )}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))
          )}
        </div>
      )}

      {/* Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4 border-t border-mm-crd/20">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-4xl font-display text-mm-g">
              {isProvider ? (currentTabLabel || 'Analítica') : (isSuperAdmin ? 'Super Administrador' : 'Panel de Control')}
            </h1>
            {isSuperAdmin && <Badge variant="oro" className="text-[10px] py-1 px-3">Acceso Total</Badge>}
          </div>
          <p className="text-mm-txs">
            {isProvider ? `Gestionando el rendimiento de tu tienda en tiempo real.` :
              isSuperAdmin ? `Bienvenido, ${state.buyerProfile.name}. Gestionando ${state.plazas.length} plazas y ${state.stores.length} tiendas.` :
                'Gestión global de la plataforma MercaMesa.'}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'plazas' && (
          <motion.div key="plazas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-display text-mm-g">Gestión de Plazas</h2>
              <Button size="sm" onClick={() => setIsAddPlazaOpen(true)}><Plus className="w-4 h-4" /> Nueva Plaza</Button>
            </div>
            <div className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mm-gbg/50 border-b border-mm-crd">
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Plaza</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Ciudad</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Tiendas</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Estado</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mm-crd">
                  {state.plazas.map(p => (
                    <tr key={p.id} className="hover:bg-mm-gbg/20">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-mm-crd shrink-0">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-6 h-6 text-mm-txw" />
                          )}
                        </div>
                        <span className="font-bold text-mm-g">{p.name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-mm-txs">{p.city}</td>
                      <td className="px-6 py-4 text-sm font-bold text-mm-g">{p.stores}</td>
                      <td className="px-6 py-4">
                        <Badge variant={p.status === 'active' ? 'success' : 'warning'}>{p.status}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g"><Edit2 className="w-4 h-4" /></button>
                          <button className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r" onClick={() => dispatch({ type: 'DELETE_PLAZA', plazaId: p.id })}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'stores' && (
          <motion.div key="stores" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-display text-mm-g">Gestión de Tiendas</h2>
              <Button size="sm" onClick={() => setIsAddStoreOpen(true)}><Plus className="w-4 h-4" /> Nueva Tienda</Button>
            </div>
            <div className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mm-gbg/50 border-b border-mm-crd">
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Tienda</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Plaza</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Dueño</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Calificación</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mm-crd">
                  {state.stores.map(s => {
                    const plaza = state.plazas.find(p => p.id === s.plazaId);
                    return (
                      <tr key={s.id} className="hover:bg-mm-gbg/20">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-mm-crd shrink-0">
                            {s.image ? (
                              <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              <StoreIcon className="w-6 h-6 text-mm-txw" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-mm-g">{s.name}</p>
                            <p className="text-[10px] text-mm-txw uppercase font-bold">Local {s.local}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-mm-txs">{plaza?.name || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-mm-txs">{s.ownerName}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-warn font-bold text-sm">
                            <Star className="w-4 h-4 fill-current" /> {s.rating}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g"><Edit2 className="w-4 h-4" /></button>
                            <button className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r" onClick={() => dispatch({ type: 'DELETE_STORE', storeId: s.id })}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'products' && (
          <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-display text-mm-g">Inventarios Consolidados</h2>
                <p className="text-sm text-mm-txs">Existencias totales y precios promedio en toda la plataforma.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><Filter className="w-4 h-4" /> Filtros</Button>
                <Button size="sm" onClick={() => setIsAddCatalogOpen(true)}><Plus className="w-4 h-4" /> Nuevo Item Catálogo</Button>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mm-gbg/50 border-b border-mm-crd">
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Producto</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Tiendas</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest text-center">Precio Promo.</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest text-center">Stock Total</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mm-crd">
                  {groupedProducts.map(group => {
                    const isExpanded = expandedProduct === group.id;
                    return (
                      <React.Fragment key={group.id}>
                        <tr
                          className={cn(
                            "hover:bg-mm-gbg/20 cursor-pointer transition-colors",
                            isExpanded ? "bg-mm-gbg/[0.15]" : ""
                          )}
                          onClick={() => setExpandedProduct(isExpanded ? null : group.id)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-mm-txw overflow-hidden shrink-0 border border-mm-crd">
                                {group.image ? (
                                  <img src={group.image} alt={group.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-6 h-6 text-mm-txw" />
                                )}
                              </div>
                              <div>
                                <span className="font-bold text-mm-g block leading-none mb-1">{group.name}</span>
                                <span className="text-[10px] text-mm-txw font-bold uppercase">{group.cat}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronRight className="w-4 h-4 text-mm-g rotate-90" /> : <ChevronRight className="w-4 h-4 text-mm-txw" />}
                              <span className={cn("text-xs font-bold", isExpanded ? "text-mm-g" : "text-mm-txs")}>
                                {group.items.length} {group.items.length === 1 ? 'tienda' : 'tiendas'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-bold text-mm-g">{fmt(group.avgPrice)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge variant="oro" className="px-3 py-1 font-mono">
                              {group.totalStock} {group.unit}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g" onClick={(e) => e.stopPropagation()}><Edit2 className="w-4 h-4" /></button>
                              <button className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r" onClick={(e) => e.stopPropagation()}><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="px-6 py-0 border-b-0">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden pb-4 pt-2"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {group.items.map(item => {
                                    const store = state.stores.find(s => s.id === item.storeId);
                                    const plaza = state.plazas.find(p => p.id === store?.plazaId);
                                    return (
                                      <div key={item.id} className="bg-mm-gbg/10 p-4 rounded-2xl border border-mm-crd/40 flex items-center justify-between group/detail hover:border-mm-g/40 transition-all">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm border border-mm-crd/30 overflow-hidden">
                                            {store?.image ? (
                                              <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                                            ) : (
                                              <StoreIcon className="w-4 h-4 text-mm-txw" />
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold text-mm-g leading-tight">{store?.name}</p>
                                            <p className="text-[9px] text-mm-txw font-bold uppercase tracking-tighter">
                                              {plaza?.name} • Local {store?.local}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="text-right flex flex-col items-end mr-2">
                                            <p className="text-sm font-bold text-mm-g">{fmt(item.retailPrice)}</p>
                                            <p className="text-[10px] text-mm-txw font-bold">{item.stock} {item.unit}</p>
                                          </div>
                                          <div className="flex gap-1">
                                            <button className="p-1.5 hover:bg-white rounded-lg text-mm-txw hover:text-mm-g bg-white/40 shadow-sm border border-mm-crd/20"><Edit2 className="w-3 h-3" /></button>
                                            <button
                                              className="p-1.5 hover:bg-white rounded-lg text-mm-txw hover:text-r bg-white/40 shadow-sm border border-mm-crd/20"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                dispatch({ type: 'DELETE_PRODUCT', productId: item.id });
                                              }}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-display text-mm-g">Todos los Pedidos</h2>
              <Badge variant="oro" className="px-4 py-1">{state.orders.length} Pedidos Totales</Badge>
            </div>
            <div className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mm-gbg/50 border-b border-mm-crd">
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Tienda</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Total</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Estado</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mm-crd">
                  {state.orders.map(o => (
                    <tr key={o.id} className="hover:bg-mm-gbg/20">
                      <td className="px-6 py-4 text-xs font-bold text-mm-txs">#{o.id}</td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <span>{o.storeEmoji}</span>
                        <span className="font-bold text-mm-g">{o.storeName}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-mm-g">{fmt(o.total)}</td>
                      <td className="px-6 py-4">
                        <Badge variant={
                          o.status === 'delivered' ? 'success' :
                            o.status === 'cancelled' ? 'error' :
                              o.status === 'on_the_way' ? 'info' : 'warning'
                        }>
                          {o.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="outline" size="sm" onClick={() => setSelectedOrder(o)}>Ver Detalle</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'projections' && (
          <motion.div key="projections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-display text-mm-g flex items-center gap-2">
                  Proyección de Demanda y Oferta <BrainCircuit className="w-6 h-6 text-mm-oro" />
                </h2>
                <p className="text-sm text-mm-txs">Algoritmos predictivos basados en históricos de consumo.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-mm-oro/10 rounded-full border border-mm-oro/20">
                  <div className="w-2 h-2 rounded-full bg-mm-oro animate-pulse" />
                  <span className="text-xs font-bold text-mm-oro">Analizando Tendencias en Vivo</span>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-display text-mm-g">Predicción de Demanda Semanal</h3>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-mm-g" />
                        <span className="text-[10px] font-bold text-mm-txw uppercase tracking-widest">Histórico</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-mm-oro" />
                        <span className="text-[10px] font-bold text-mm-txw uppercase tracking-widest">Proyección IA</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={projectionData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6DD" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#3A5248', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#3A5248', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="actual" fill="#4C7A5E" fillOpacity={0.1} stroke="none" />
                        <Line type="monotone" dataKey="actual" stroke="#4C7A5E" strokeWidth={3} dot={{ r: 4, fill: '#4C7A5E' }} />
                        <Line type="monotone" dataKey="projected" stroke="#E8734A" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 6, fill: '#E8734A' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm border-l-4 border-l-mm-g">
                    <p className="text-[10px] text-mm-txw font-bold uppercase mb-2">Pico de Demanda</p>
                    <h4 className="text-xl font-bold text-mm-g mb-1">Próximo Sábado</h4>
                    <p className="text-xs text-mm-txs">Aumento proyectado del 28% en granos.</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm border-l-4 border-l-mm-oro">
                    <p className="text-[10px] text-mm-txw font-bold uppercase mb-2">Producto Tendencia</p>
                    <h4 className="text-xl font-bold text-mm-g mb-1">Aguacate Hass</h4>
                    <p className="text-xs text-mm-txs">Alta rotación esperada en Plaza Central.</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm border-l-4 border-l-r">
                    <p className="text-[10px] text-mm-txw font-bold uppercase mb-2">Riesgo de Desabasto</p>
                    <h4 className="text-xl font-bold text-mm-g mb-1">Papa Sabanera</h4>
                    <p className="text-xs text-mm-txs">Stock actual cubrirá solo 2 días más.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-mm-g text-white p-8 rounded-[40px] shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                  <h3 className="text-xl font-display mb-4 relative z-10">Recomendaciones de Reabastecimiento</h3>
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-start gap-3 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                      <Zap className="w-5 h-5 text-mm-oro shrink-0 mt-1" />
                      <div>
                        <p className="text-sm font-bold">Incentivar oferta de Frutas</p>
                        <p className="text-[10px] opacity-80">Se detecta exceso de oferta para el fin de semana.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                      <ArrowUpRight className="w-5 h-5 text-ok shrink-0 mt-1" />
                      <div>
                        <p className="text-sm font-bold">Ajustar Precios en Plaza Sur</p>
                        <p className="text-[10px] opacity-80">Oportunidad de incremento de margen en lácteos.</p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-6 bg-transparent border-white text-white hover:bg-white hover:text-mm-g">Generar Informe IA</Button>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
                  <h4 className="font-display text-mm-g mb-6">Precisión del Modelo</h4>
                  <div className="flex items-center gap-6 mb-8">
                    <div className="relative w-20 h-20">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-mm-gbg" />
                        <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="219.9" strokeDashoffset="11" className="text-mm-g" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-mm-g">95%</div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-mm-g">Alta Confianza</p>
                      <p className="text-xs text-mm-txs">Basado en 2,450 transacciones analizadas.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-mm-txs">Sesgo Estacional</span>
                      <span className="font-bold text-mm-g">Bajo (-2.1%)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-mm-txs">Ruido de Mercado</span>
                      <span className="font-bold text-mm-g">Moderado</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'reputation' && (
          <motion.div key="reputation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-display text-mm-g flex items-center gap-2">
                  Gestión de Reputación y Calificaciones <Star className="w-6 h-6 text-mm-oro fill-mm-oro" />
                </h2>
                <p className="text-sm text-mm-txs">Monitoreo de satisfacción del cliente y calidad del servicio.</p>
              </div>
              <div className="bg-mm-gbg p-4 rounded-2xl border border-mm-crd max-w-xs">
                <div className="flex items-center gap-3 mb-1">
                  <Info className="w-4 h-4 text-mm-g shrink-0" />
                  <p className="text-[10px] font-bold text-mm-g uppercase">Cálculo de Estrellas</p>
                </div>
                <p className="text-[11px] text-mm-txs leading-relaxed">
                  El sistema calcula el rating como el <span className="font-bold text-mm-g">promedio simple</span> de todas las reseñas:
                  <span className="block mt-1 font-mono bg-white/50 p-1 rounded">Rating = Suma(Estrellas) / Total Reseñas</span>
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <h3 className="text-lg font-display text-mm-g">Ranking de Tiendas</h3>
                <div className="space-y-3">
                  {state.stores
                    .filter(s => !isProvider || s.id === state.stores[0].id)
                    .sort((a, b) => b.rating - a.rating).map((store, i) => (
                      <div
                        key={store.id}
                        onClick={() => setFilterStoreId(store.id)}
                        className={cn(
                          "bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-colors cursor-pointer group",
                          filterStoreId === store.id ? "border-mm-g bg-mm-gbg/20 shadow-md ring-1 ring-mm-g/20" : "border-mm-crd hover:border-mm-g"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                            filterStoreId === store.id ? "bg-mm-g text-white" : "bg-mm-gbg text-mm-g"
                          )}>
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-mm-g">{store.name}</p>
                            <p className="text-[10px] text-mm-txw font-bold uppercase">{store.reviewCount} reseñas</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-warnl px-3 py-1 rounded-full border border-warn/20">
                          <Star className="w-3.5 h-3.5 text-mm-oro fill-mm-oro" />
                          <span className="text-xs font-bold text-mm-oro">{store.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-display text-mm-g">
                      {filterStoreId === 'all'
                        ? (isProvider ? 'Reseñas de mi Tienda' : 'Historial de Reseñas Recientes')
                        : `Reseñas de ${state.stores.find(s => s.id === filterStoreId)?.name}`
                      }
                    </h3>
                    {filterStoreId !== 'all' && !isProvider && (
                      <button
                        onClick={() => setFilterStoreId('all')}
                        className="text-[10px] font-black uppercase text-mm-g hover:underline underline-offset-4"
                      >
                        Ver todas
                      </button>
                    )}
                  </div>
                  <Badge variant="default">
                    {state.reviews.filter(r => {
                      if (filterStoreId === 'all') return !isProvider || r.storeId === state.stores[0].id;
                      return r.storeId === filterStoreId;
                    }).length} Reseñas
                  </Badge>
                </div>

                <div className="space-y-4">
                  {state.reviews
                    .filter(r => {
                      if (filterStoreId === 'all') return !isProvider || r.storeId === state.stores[0].id;
                      return r.storeId === filterStoreId;
                    })
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(review => {
                      const store = state.stores.find(s => s.id === review.storeId);
                      return (
                        <div key={review.id} className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-mm-gbg flex items-center justify-center text-mm-g font-bold">
                                {review.buyerName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-mm-g">{review.buyerName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={cn(
                                          "w-3 h-3",
                                          i < review.stars ? "text-mm-oro fill-mm-oro" : "text-mm-crd fill-mm-crd"
                                        )}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-mm-txw font-bold uppercase">• {new Date(review.date).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-mm-gbg/50 rounded-lg border border-mm-crd/50">
                              <StoreIcon className="w-3 h-3 text-mm-txs" />
                              <span className="text-[10px] font-bold text-mm-txs uppercase">{store?.name}</span>
                            </div>
                          </div>
                          <p className="text-sm text-mm-txs italic leading-relaxed">
                            "{review.comment}"
                          </p>
                          <div className="flex gap-2 pt-2">
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold tracking-widest text-mm-txw hover:text-mm-g">
                              <MessageSquare className="w-3.5 h-3.5 mr-1" /> Responder
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold tracking-widest text-mm-txw hover:text-r">
                              <AlertCircle className="w-3.5 h-3.5 mr-1" /> Reportar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {!isProvider && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-okl text-ok rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest">Ingresos Totales</p>
                    <p className="text-xl font-bold text-mm-g">{fmt(totalRevenue)}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-bluel text-blue rounded-2xl flex items-center justify-center">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest">Pedidos Activos</p>
                    <p className="text-xl font-bold text-mm-g">{activeOrders}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-mm-orl text-mm-oro rounded-2xl flex items-center justify-center">
                    <StoreIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest">Tiendas Aliadas</p>
                    <p className="text-xl font-bold text-mm-g">{state.stores.length}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-mm-gbg text-mm-g rounded-2xl flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-mm-txw font-bold uppercase tracking-widest">Usuarios Plataforma</p>
                    <p className="text-xl font-bold text-mm-g">1.2k</p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
                <h3 className="text-xl font-display text-mm-g mb-8">Ingresos Semanales</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={WEEK_DATA}>
                      <defs>
                        <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4C7A5E" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#4C7A5E" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6DD" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#3A5248', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#3A5248', fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
                      <Tooltip />
                      <Area type="monotone" dataKey="v" stroke="#4C7A5E" strokeWidth={3} fillOpacity={1} fill="url(#colorV)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
                <h3 className="text-xl font-display text-mm-g mb-8">Distribución por Categoría</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={CAT_DATA}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="v"
                      >
                        {CAT_DATA.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-display text-mm-g">Consolidado de Inventario por Tienda</h3>
                  <p className="text-xs text-mm-txs">Desglose de productos, existencias totales y valoración por punto de venta.</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="oro" className="px-3 py-1">Vista Operativa</Badge>
                </div>
              </div>

              <div className="overflow-x-auto -mx-8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-mm-gbg/30 border-y border-mm-crd">
                      <th className="px-8 py-4 text-[10px] font-bold text-mm-txw uppercase tracking-widest">Tienda / Local</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-mm-txw uppercase tracking-widest">Plaza</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-mm-txw uppercase tracking-widest text-center">Variedad SKUs</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-mm-txw uppercase tracking-widest text-center">Stock Físico Total</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-mm-txw uppercase tracking-widest text-right">Valoración Estimada</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-mm-txw uppercase tracking-widest text-center">Alertas</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-mm-txw uppercase tracking-widest text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mm-crd">
                    {storeStockSummary.map(store => (
                      <React.Fragment key={store.id}>
                        <tr className="hover:bg-mm-gbg/10 transition-colors">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-mm-gbg rounded-xl flex items-center justify-center text-mm-g font-bold border border-mm-crd">
                                {store.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-mm-g">{store.name}</p>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={cn("w-2.5 h-2.5", i < Math.floor(store.rating) ? "fill-mm-oro text-mm-oro" : "text-mm-crd")} />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-mm-txs font-medium">{store.plazaPath}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <p className="text-sm font-bold text-mm-g">{store.itemCount}</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-mm-gbg/40 rounded-full">
                              <Package className="w-3.5 h-3.5 text-mm-g" />
                              <span className="text-sm font-bold text-mm-g">{store.totalStock.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-bold text-mm-g">{fmt(store.totalValue)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              {store.lowStockCount > 0 ? (
                                <Badge variant="error" className="animate-pulse flex gap-1 items-center">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {store.lowStockCount} Bajo Stock
                                </Badge>
                              ) : (
                                <div className="w-6 h-6 bg-okl text-ok rounded-full flex items-center justify-center">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn("rounded-xl px-4", stockStoreDetail === store.id && "bg-mm-g text-white")}
                              onClick={() => setStockStoreDetail(stockStoreDetail === store.id ? null : store.id)}
                            >
                              {stockStoreDetail === store.id ? 'Ocultar' : 'Ver Inventario'}
                            </Button>
                          </td>
                        </tr>
                        <AnimatePresence>
                          {stockStoreDetail === store.id && (
                            <tr>
                              <td colSpan={7} className="px-8 py-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="py-6 px-10 bg-mm-gbg/20 border-x border-mm-crd">
                                    <div className="flex items-center justify-between mb-6">
                                      <h4 className="text-sm font-black text-mm-txw uppercase tracking-[0.2em]">Inventario por Producto - {store.name}</h4>
                                      <Badge variant="oro">{store.itemCount} SKUs activos</Badge>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                      {store.products.map(p => (
                                        <div key={p.id} className="bg-white p-4 rounded-2xl border border-mm-crd shadow-sm flex items-center gap-4 group hover:border-mm-g transition-colors">
                                          <div className="w-12 h-12 bg-mm-gbg rounded-xl flex items-center justify-center text-2xl overflow-hidden border border-mm-crd shadow-inner">
                                            {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : p.emoji}
                                          </div>
                                          <div className="flex-grow">
                                            <p className="font-bold text-mm-g text-sm mb-0.5">{p.name}</p>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-bold text-mm-txw uppercase">{p.cat}</span>
                                              <span className="w-1 h-1 rounded-full bg-mm-crd" />
                                              <span className="text-[10px] font-bold text-mm-g">{fmt(p.retailPrice)} / {p.unit}</span>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className={cn(
                                              "text-sm font-black transition-colors",
                                              p.stock < p.minStock ? "text-r" : "text-mm-g"
                                            )}>
                                              {p.stock} <span className="text-[10px] opacity-60 uppercase">{p.unit}</span>
                                            </p>
                                            <div className="h-1 w-12 bg-mm-gbg rounded-full mt-1 ml-auto overflow-hidden">
                                              <div
                                                className={cn("h-full", p.stock < p.minStock ? "bg-r" : "bg-mm-g")}
                                                style={{ width: `${Math.min(100, (p.stock / (p.minStock || 1)) * 50)}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {store.products.length === 0 && (
                                      <div className="py-10 text-center opacity-40">
                                        <Package className="w-10 h-10 mx-auto mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Sin productos registrados</p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-display text-mm-g">Inventario Global por Producto (Suma Total)</h3>
                  <p className="text-xs text-mm-txs">Consolidado de existencias sumando todos los puntos de venta.</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="oro" className="px-3 py-1">Stock Consolidado</Badge>
                </div>
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={globalStockData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E6DD" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#3A5248', fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#3A5248', fontSize: 13, fontWeight: 'bold' }}
                      width={120}
                    />
                    <Tooltip
                      cursor={{ fill: '#EEF2E8', opacity: 0.4 }}
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '16px' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '13px', color: '#4C7A5E' }}
                    />
                    <Bar
                      dataKey="total"
                      fill="#4C7A5E"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-display text-mm-g">Existencias por Producto y Tienda (Filtro Dinámico)</h3>
                  <p className="text-xs text-mm-txs">Desglose de stock total por cada punto de venta.</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="oro" className="px-3 py-1">Stock Vivo</Badge>
                </div>
              </div>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stockAnalyticsData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    barGap={0}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E6DD" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#3A5248', fontSize: 13, fontWeight: 'bold' }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#3A5248', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: '#EEF2E8', opacity: 0.4 }}
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '16px' }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '13px' }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={50}
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold', color: '#3A5248' }}
                    />
                    {uniqueStoreNames.map((storeName, index) => (
                      <Bar
                        key={storeName}
                        dataKey={storeName}
                        stackId="a"
                        fill={chartPalette[index % chartPalette.length]}
                        radius={index === uniqueStoreNames.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                        barSize={50}
                        animationDuration={1500}
                        animationBegin={index * 100}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm">
                <h3 className="text-xl font-display text-mm-g mb-6">Actividad Reciente en la Plataforma</h3>
                <div className="space-y-4">
                  {state.orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-mm-gbg/30 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">{order.storeEmoji}</div>
                        <div>
                          <p className="text-sm font-bold text-mm-g">{order.storeName}</p>
                          <p className="text-[10px] text-mm-txs uppercase font-bold tracking-tighter">Pedido {order.id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-mm-g">{fmt(order.total)}</p>
                        <p className="text-[10px] text-mm-txs">{order.items.length} productos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'catalog' && (
          <motion.div key="catalog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-display text-mm-g">Catálogo Maestro</h2>
                <p className="text-sm text-mm-txs">Productos preestablecidos disponibles para las tiendas.</p>
              </div>
              <Button size="sm" onClick={() => setIsAddCatalogOpen(true)}><Plus className="w-4 h-4" /> Nuevo Item</Button>
            </div>
            <div className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mm-gbg/50 border-b border-mm-crd">
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Producto</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Categoría</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Unidad Defecto</th>
                    <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mm-crd">
                  {state.catalog.map(item => (
                    <tr key={item.id} className="hover:bg-mm-gbg/20">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-mm-gbg rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-mm-crd">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            item.emoji
                          )}
                        </div>
                        <span className="font-bold text-mm-g">{item.name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-mm-txs">
                        <Badge variant="default">{item.cat}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-mm-txs font-medium">{item.defaultUnit}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r" onClick={() => dispatch({ type: 'DELETE_CATALOG_ITEM', id: item.id })}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}


      </AnimatePresence>

      <AnimatePresence>
        {isAddStoreOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddStoreOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsAddStoreOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-display text-mm-g mb-6">Nueva Tienda</h2>

              <form onSubmit={handleAddStore} className="space-y-4 max-h-[70vh] overflow-y-auto px-1 pr-4 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-mm-txs ml-1">Imagen de la Tienda</label>
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border-2 border-dashed border-mm-crd group relative">
                      {newStore.image ? (
                        <img src={newStore.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <ImageIcon className="w-6 h-6 text-mm-txw" />
                          <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStoreImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex-grow space-y-2">
                      <Input
                        label="Emoji Alternativo"
                        value={newStore.emoji}
                        onChange={e => setNewStore({ ...newStore, emoji: e.target.value })}
                        placeholder="🏪"
                      />
                      <p className="text-[10px] text-mm-txw leading-tight">El emoji se usará como respaldo si no hay imagen.</p>
                    </div>
                  </div>
                </div>

                <Input
                  label="Nombre de la Tienda"
                  value={newStore.name}
                  onChange={e => setNewStore({ ...newStore, name: e.target.value })}
                  placeholder="Ej: Frutería Don Chucho"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Local #"
                    value={newStore.local}
                    onChange={e => setNewStore({ ...newStore, local: e.target.value })}
                    placeholder="Ej: 102"
                    required
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-mm-txs ml-1">Plaza</label>
                    <select
                      value={newStore.plazaId}
                      onChange={e => setNewStore({ ...newStore, plazaId: Number(e.target.value) })}
                      className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
                    >
                      {state.plazas.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Hora Apertura"
                    type="time"
                    value={newStore.openTime}
                    onChange={e => setNewStore({ ...newStore, openTime: e.target.value })}
                    required
                  />
                  <Input
                    label="Hora Cierre"
                    type="time"
                    value={newStore.closeTime}
                    onChange={e => setNewStore({ ...newStore, closeTime: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Teléfono Info"
                    value={newStore.phone}
                    onChange={e => setNewStore({ ...newStore, phone: e.target.value })}
                    placeholder="+57..."
                    required
                  />
                  <Input
                    label="Correo Electrónico"
                    type="email"
                    value={newStore.email}
                    onChange={e => setNewStore({ ...newStore, email: e.target.value })}
                    placeholder="tienda@ejemplo.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Latitud"
                    type="number"
                    step="0.0001"
                    value={newStore.lat}
                    onChange={e => setNewStore({ ...newStore, lat: Number(e.target.value) })}
                    placeholder="6.2442"
                    required
                  />
                  <Input
                    label="Longitud"
                    type="number"
                    step="0.0001"
                    value={newStore.lng}
                    onChange={e => setNewStore({ ...newStore, lng: Number(e.target.value) })}
                    placeholder="-75.5812"
                    required
                  />
                </div>

                <Input
                  label="Página Web (Opcional)"
                  value={newStore.website}
                  onChange={e => setNewStore({ ...newStore, website: e.target.value })}
                  placeholder="https://..."
                />

                <Input
                  label="Categoría"
                  value={newStore.cat}
                  onChange={e => setNewStore({ ...newStore, cat: e.target.value })}
                  placeholder="Ej: Frutas y Verduras"
                  required
                />

                <div className="pt-4 flex gap-3 pb-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddStoreOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Crear Tienda
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddPlazaOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddPlazaOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsAddPlazaOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-display text-mm-g mb-6">Nueva Plaza</h2>

              <form onSubmit={handleAddPlaza} className="space-y-4 max-h-[70vh] overflow-y-auto px-1 pr-4 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-mm-txs ml-1">Imagen de la Plaza</label>
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border-2 border-dashed border-mm-crd group relative">
                      {newPlaza.image ? (
                        <img src={newPlaza.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <ImageIcon className="w-6 h-6 text-mm-txw" />
                          <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePlazaImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex-grow space-y-2">
                      <Input
                        label="Emoji Alternativo"
                        value={newPlaza.emoji}
                        onChange={e => setNewPlaza({ ...newPlaza, emoji: e.target.value })}
                        placeholder="🏛️"
                      />
                      <p className="text-[10px] text-mm-txw leading-tight">El emoji se usará si no subes una imagen o como icono pequeño.</p>
                    </div>
                  </div>
                </div>

                <Input
                  label="Nombre de la Plaza"
                  value={newPlaza.name}
                  onChange={e => setNewPlaza({ ...newPlaza, name: e.target.value })}
                  placeholder="Ej: Plaza Minorista"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Ciudad"
                    value={newPlaza.city}
                    onChange={e => setNewPlaza({ ...newPlaza, city: e.target.value })}
                    placeholder="Ej: Medellín"
                    required
                  />
                  <Input
                    label="Color de Fondo"
                    type="color"
                    value={newPlaza.bg}
                    onChange={e => setNewPlaza({ ...newPlaza, bg: e.target.value })}
                    required
                  />
                </div>

                <Input
                  label="Dirección / Ubicación Exacta"
                  value={newPlaza.address}
                  onChange={e => setNewPlaza({ ...newPlaza, address: e.target.value })}
                  placeholder="Ej: Calle 50 # 50-50"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Hora Apertura"
                    type="time"
                    value={newPlaza.openTime}
                    onChange={e => setNewPlaza({ ...newPlaza, openTime: e.target.value })}
                    required
                  />
                  <Input
                    label="Hora Cierre"
                    type="time"
                    value={newPlaza.closeTime}
                    onChange={e => setNewPlaza({ ...newPlaza, closeTime: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Teléfono Info"
                    value={newPlaza.phone}
                    onChange={e => setNewPlaza({ ...newPlaza, phone: e.target.value })}
                    placeholder="+57..."
                    required
                  />
                  <Input
                    label="Correo Electrónico"
                    type="email"
                    value={newPlaza.email}
                    onChange={e => setNewPlaza({ ...newPlaza, email: e.target.value })}
                    placeholder="plaza@ejemplo.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Latitud"
                    type="number"
                    step="0.0001"
                    value={newPlaza.lat}
                    onChange={e => setNewPlaza({ ...newPlaza, lat: Number(e.target.value) })}
                    placeholder="6.2442"
                    required
                  />
                  <Input
                    label="Longitud"
                    type="number"
                    step="0.0001"
                    value={newPlaza.lng}
                    onChange={e => setNewPlaza({ ...newPlaza, lng: Number(e.target.value) })}
                    placeholder="-75.5812"
                    required
                  />
                </div>

                <Input
                  label="Página Web (Opcional)"
                  value={newPlaza.website}
                  onChange={e => setNewPlaza({ ...newPlaza, website: e.target.value })}
                  placeholder="https://..."
                />

                <div className="pt-4 flex gap-3 pb-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddPlazaOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Crear Plaza
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddProductOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddProductOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-display text-mm-g mb-6">Nuevo Producto</h2>

              <form onSubmit={handleAddProduct} className="space-y-4 max-h-[70vh] overflow-y-auto px-1 pr-4 custom-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-mm-txs ml-1">Imagen del Producto</label>
                    <div className="flex gap-4">
                      <div className="w-24 h-24 bg-mm-gbg/20 rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border-2 border-dashed border-mm-crd group relative">
                        {newProduct.image ? (
                          <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <ImageIcon className="w-6 h-6 text-mm-txw" />
                            <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProductImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <p className="text-[10px] text-mm-txs leading-tight">Selecciona una imagen clara del producto.</p>
                        <Input
                          label="Emoji Alternativo"
                          value={newProduct.emoji || '📦'}
                          onChange={e => setNewProduct({ ...newProduct, emoji: e.target.value })}
                          placeholder="📦"
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-mm-txs ml-1">Nombre del Producto</label>
                    <Input
                      value={newProduct.name}
                      onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Ej: Tomate Chonto Special"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-mm-txs ml-1">Tienda Destino</label>
                      <select
                        value={newProduct.storeId}
                        onChange={e => setNewProduct({ ...newProduct, storeId: Number(e.target.value) })}
                        className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
                        required
                      >
                        <option value="">Seleccione tienda...</option>
                        {state.stores.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-mm-txs ml-1">Categoría</label>
                      <select
                        value={newProduct.cat}
                        onChange={e => setNewProduct({ ...newProduct, cat: e.target.value })}
                        className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
                        required
                      >
                        {Array.from(new Set(state.catalog.map(i => i.cat))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="Varios">Varios</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Unidad"
                      value={newProduct.unit}
                      onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}
                      placeholder="Ej: kg, lb, unidad"
                      required
                    />
                    <Input
                      label="Precio Minorista"
                      type="number"
                      value={newProduct.retailPrice || ''}
                      onChange={e => setNewProduct({ ...newProduct, retailPrice: Number(e.target.value) })}
                      placeholder="0"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1">
                    <Input
                      label="Stock Inicial"
                      type="number"
                      value={newProduct.stock || ''}
                      onChange={e => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                {(!isProvider || isSuperAdmin) && false && (
                  <Input
                    label="Categoría"
                    value={newProduct.cat}
                    onChange={e => setNewProduct({ ...newProduct, cat: e.target.value })}
                    placeholder="Ej: Verduras"
                    required
                  />
                )}

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddProductOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Crear Producto
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddOfferOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddOfferOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsAddOfferOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-display text-mm-g mb-6">Nueva Oferta</h2>

              <form onSubmit={handleAddOffer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-mm-txs ml-1">Imagen de la Oferta</label>
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-mm-gbg/20 rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border-2 border-dashed border-mm-crd group relative">
                      {newOffer.image ? (
                        <img src={newOffer.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <ImageIcon className="w-6 h-6 text-mm-txw" />
                          <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleOfferImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex-grow flex flex-col justify-center">
                      <p className="text-[10px] text-mm-txw leading-tight">Usa una imagen llamativa para captar la atención de tus clientes.</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-mm-gbg rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border border-mm-crd">
                    {newOffer.image ? (
                      <img src={newOffer.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      newOffer.emoji
                    )}
                  </div>
                  <Input
                    label="Emoji (si no hay imagen)"
                    value={newOffer.emoji}
                    onChange={e => setNewOffer({ ...newOffer, emoji: e.target.value })}
                    placeholder="🏷️"
                  />
                </div>

                <Input
                  label="Título de la Oferta"
                  value={newOffer.title}
                  onChange={e => setNewOffer({ ...newOffer, title: e.target.value })}
                  placeholder="Ej: Black Friday en Carnes"
                  required
                />

                <Input
                  label="Descripción"
                  value={newOffer.desc}
                  onChange={e => setNewOffer({ ...newOffer, desc: e.target.value })}
                  placeholder="Ej: 20% de descuento en pollo fresco"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-mm-txs ml-1">Tipo Descuento</label>
                    <select
                      value={newOffer.type}
                      onChange={e => setNewOffer({ ...newOffer, type: e.target.value as any })}
                      className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
                    >
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Fijo ($)</option>
                    </select>
                  </div>
                  <Input
                    label="Valor Descuento"
                    type="number"
                    value={newOffer.value}
                    onChange={e => setNewOffer({ ...newOffer, value: Number(e.target.value) })}
                    placeholder="Ej: 15"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-mm-txs ml-1">Productos Asociados</label>
                  <div className="flex flex-wrap gap-2 p-3 border-1.5 border-mm-crd rounded-xl max-h-32 overflow-y-auto">
                    {state.products
                      .filter(p => !isProvider || p.storeId === state.stores[0].id)
                      .map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const exists = newOffer.productIds.includes(p.id);
                            if (exists) {
                              setNewOffer({ ...newOffer, productIds: newOffer.productIds.filter(id => id !== p.id) });
                            } else {
                              setNewOffer({ ...newOffer, productIds: [...newOffer.productIds, p.id] });
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            newOffer.productIds.includes(p.id)
                              ? "bg-mm-g text-white border-mm-g"
                              : "bg-mm-gbg text-mm-txs border-transparent hover:bg-mm-crd"
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>
                  <p className="text-[10px] text-mm-txw mt-1">Selecciona los productos que entran en la oferta</p>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddOfferOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Crear Oferta
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddCatalogOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCatalogOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10"
            >
              <button
                onClick={() => setIsAddCatalogOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6 text-mm-txs" />
              </button>

              <h2 className="text-3xl font-display text-mm-g mb-6">Nuevo Item Catálogo</h2>

              <form onSubmit={handleAddCatalogItem} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-mm-txs ml-1">Imagen del Producto</label>
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border-2 border-dashed border-mm-crd group relative">
                      {newCatalogItem.image ? (
                        <img src={newCatalogItem.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <ImageIcon className="w-6 h-6 text-mm-txw" />
                          <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCatalogImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex-grow space-y-2">
                      <Input
                        label="Emoji Alternativo"
                        value={newCatalogItem.emoji}
                        onChange={e => setNewCatalogItem({ ...newCatalogItem, emoji: e.target.value })}
                        placeholder="📦"
                      />
                    </div>
                  </div>
                </div>

                <Input
                  label="Nombre del Producto"
                  value={newCatalogItem.name}
                  onChange={e => setNewCatalogItem({ ...newCatalogItem, name: e.target.value })}
                  placeholder="Ej: Tomate Chonto"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Categoría"
                    value={newCatalogItem.cat}
                    onChange={e => setNewCatalogItem({ ...newCatalogItem, cat: e.target.value })}
                    placeholder="Ej: Verduras"
                    required
                  />
                  <Input
                    label="Unidad por Defecto"
                    value={newCatalogItem.defaultUnit}
                    onChange={e => setNewCatalogItem({ ...newCatalogItem, defaultUnit: e.target.value })}
                    placeholder="Ej: kg"
                    required
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddCatalogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    Crear Item
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {selectedOrder && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-mm-g/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-xl w-full max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-mm-crd flex items-center justify-between bg-mm-gbg/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-mm-oro/10 flex items-center justify-center text-mm-oro">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display text-mm-g">Pedido {formatOrderCode(selectedOrder.code, selectedOrder.storeOrderId)}</h2>
                    <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">{new Date(selectedOrder.date).toLocaleString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-mm-gbg rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-mm-txw" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-mm-txw">
                    <Package className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Contenido del Pedido</span>
                  </div>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4 bg-mm-gbg/30 rounded-2xl border border-mm-crd/50">
                        <div className="w-12 h-12 rounded-xl bg-white border border-mm-crd flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-2xl">{item.emoji}</span>
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="font-bold text-mm-g">{item.name}</p>
                          <p className="text-xs text-mm-txw">{fmt(item.price)} / {item.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-mm-g">
                            {item.qty} {item.unit}{item.qty !== 1 && item.unit !== 'kg' ? 's' : ''}
                          </p>
                          <p className="text-[10px] font-bold text-blue uppercase tabular-nums">{fmt(item.price * item.qty)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-mm-crd/50 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-mm-txw mb-2">
                        <User2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cliente</span>
                      </div>
                      <p className="text-sm font-bold text-mm-g">{selectedOrder.buyerId}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-mm-txw mb-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Pago</span>
                      </div>
                      <p className="text-sm font-bold text-mm-g uppercase">{selectedOrder.paymentMethod}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-mm-txw mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Dirección de Entrega</span>
                    </div>
                    <p className="text-sm font-bold text-mm-g">{selectedOrder.address}</p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-mm-gbg/10 border-t border-mm-crd">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-mm-txw">Total del Pedido</span>
                  <span className="text-3xl font-display text-mm-g">{fmt(selectedOrder.total)}</span>
                </div>
                <Button
                  onClick={() => setSelectedOrder(null)}
                  variant="primary"
                  className="w-full mt-6 py-4"
                >
                  Cerrar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
