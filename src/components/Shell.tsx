import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { ROLES, C, fmt } from '../constants';
import { RoleKey, CartItem } from '../types';
import { Button, Badge, cn } from './Shared';
import {
  Search, ShoppingCart, Bell, User, LogOut, Star,
  LayoutDashboard, ShoppingBag, ClipboardList,
  MessageSquare, TrendingUp, Map, Settings,
  ChevronRight, Trash2, Minus, Plus, MapPin, CreditCard,
  Leaf, Package, X, Image as ImageIcon, ChevronDown, Truck,
  Store as StoreIcon, Tag, History
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function Topbar({ onCartOpen, onToggleSidebar }: { onCartOpen: () => void; onToggleSidebar: () => void }) {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const cartCount = state.cart.reduce((acc, item) => acc + item.qty, 0);
  const unreadNotifs = state.notifs.filter(n => !n.read).length;

  return (
    <header className="fixed top-0 left-0 w-full h-16 bg-mm-g text-white z-[60] flex items-center justify-between px-4 lg:px-8 shadow-lg">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0"
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-mm-oro rounded-lg flex items-center justify-center shadow-inner">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold font-fraunces hidden sm:block">Mercamesa</span>
        </div>
      </div>

      <div className="flex-grow max-w-xl mx-8 hidden lg:block text-mm-gll font-medium text-sm tracking-wide">
        {state.userRole === 'admin' ? 'PANEL DE ADMINISTRACIÓN' :
          state.userRole === 'provider' ? 'GESTIÓN DE PROVEEDOR' :
            state.userRole === 'delivery' ? 'CENTRO DE REPARTO' :
              'MARKETPLACE MERCAMESA'}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden xl:flex items-center bg-white/10 rounded-full p-1 border border-white/20">
          {ROLES.map(r => {
            const roleRoute: Record<string, string> = {
              retail: '/marketplaces', wholesale: '/marketplaces',
              provider: '/seller/dashboard', delivery: '/delivery', admin: '/admin/marketplaces',
            };
            const Icon = { ShoppingBag, TrendingUp, Store: StoreIcon, Truck, Settings }[r.icon] || ShoppingBag;
            return (
              <button
                key={r.k}
                onClick={() => { dispatch({ type: 'SET_ROLE', role: r.k }); router.push(roleRoute[r.k] || '/marketplaces'); }}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                  state.userRole === r.k ? "bg-white text-mm-g shadow-sm" : "text-white/60 hover:text-white"
                )}
              >
                <Icon className="w-3 h-3" />
                {r.k}
              </button>
            )
          })}
        </div>

        <button
          onClick={onCartOpen}
          className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ShoppingCart className="w-6 h-6" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-mm-oro text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-mm-g animate-pop-in">
              {cartCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 pl-2 border-l border-white/20 ml-2 hover:bg-white/10 p-1 rounded-xl transition-all"
          >
            <div className="w-9 h-9 bg-mm-gll rounded-full flex items-center justify-center text-xl border-2 border-white/20 overflow-hidden shrink-0">
              <img src={state.buyerProfile.avatar} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-none">{state.buyerProfile.name}</p>
              <p className="text-[10px] text-mm-gll uppercase font-bold tracking-tighter">{state.userRole}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-mm-gll transition-transform", showProfileMenu && "rotate-180")} />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-mm-crd z-50 overflow-hidden py-2"
                >
                  <div className="px-4 py-3 border-b border-mm-crd mb-2">
                    <p className="text-xs text-mm-txw font-bold uppercase tracking-widest leading-none mb-1">Tu Cuenta</p>
                    <p className="text-sm font-bold text-mm-g truncate truncate">{state.buyerProfile.name}</p>
                  </div>

                  <button
                    onClick={() => { router.push('/profile'); setShowProfileMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-mm-txs hover:bg-mm-gbg hover:text-mm-g flex items-center gap-2 transition-colors"
                  >
                    <User className="w-4 h-4" /> Mi Perfil
                  </button>
                  <button
                    onClick={() => { router.push('/support'); setShowProfileMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-mm-txs hover:bg-mm-gbg hover:text-mm-g flex items-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" /> Ayuda y Soporte
                  </button>

                  <div className="h-px bg-mm-crd my-2" />

                  <button
                    onClick={async () => {
                      const supabase = createSupabaseBrowserClient();

                      await supabase.auth.signOut();

                      router.push('/');

                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-r hover:bg-rl flex items-center gap-2 transition-colors font-bold"
                  >
                    <LogOut className="w-4 h-4" /> Cerrar Sesión
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

import { Sidebar as DynamicSidebar } from '../../components/ui/shell/components/Sidebar';

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return <DynamicSidebar collapsed={collapsed} />;
}

export function CartPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const router = useRouter();

  const storesInCart = Array.from(new Set(state.cart.map(i => i.storeId)));
  const cartByStore = storesInCart.map(storeId => ({
    store: state.stores.find(s => s.id === storeId)!,
    items: state.cart.filter(i => i.storeId === storeId)
  }));

  const isWS = state.userRole === 'wholesale';
  const getPrice = (item: CartItem) => isWS ? item.wsPrice : item.retailPrice;

  const total = state.cart.reduce((acc, item) => acc + (getPrice(item) * item.qty), 0);
  const defaultAddress = state.buyerProfile.addresses.find(a => a.isDefault);

  const [itemModes, setItemModes] = useState<Record<number, 'base' | 'alt'>>({});

  const toggleItemMode = (id: number) => {
    setItemModes(prev => ({
      ...prev,
      [id]: prev[id] === 'alt' ? 'base' : 'alt'
    }));
  };

  const handlePlaceOrder = () => {
    const newOrders = cartByStore.map(group => ({
      id: `MM-${Math.floor(Math.random() * 1000000)}`,
      date: new Date().toISOString(),
      storeId: group.store.id,
      storeName: group.store.name,
      storeEmoji: group.store.emoji,
      items: group.items.map(i => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: getPrice(i),
        unit: i.unit,
        emoji: i.emoji,
        image: i.image
      })),
      total: group.items.reduce((acc, i) => acc + (getPrice(i) * i.qty), 0),
      status: 'pending' as const,
      buyerId: 'user-1',
      address: defaultAddress ? `${defaultAddress.street}, ${defaultAddress.neighborhood}` : 'Dirección no especificada',
      paymentMethod: state.buyerProfile.payments.find(p => p.isDefault)?.label || 'Efectivo'
    }));

    dispatch({ type: 'PLACE_ORDER', orders: newOrders });

    // Add notification
    const notif = {
      id: Date.now().toString(),
      title: '¡Pedido realizado!',
      msg: `Has realizado ${newOrders.length} pedido(s) con éxito.`,
      type: 'order_new' as const,
      time: 'Ahora',
      read: false
    };
    dispatch({ type: 'ADD_NOTIF', notif });

    // Redirect to orders
    router.push('/orders');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-mm-g/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-full max-w-md h-full bg-white shadow-2xl z-[110] flex flex-col"
          >
            <div className="p-6 border-b border-mm-crd flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-mm-gbg rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-mm-oro" />
                </div>
                <h2 className="text-2xl font-fraunces text-mm-g">Tu Carrito</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-mm-gbg rounded-full transition-colors">
                <X className="w-6 h-6 text-mm-txs" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-8 scrollbar-hide">
              {state.cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <ShoppingBag className="w-20 h-20 text-mm-txw mb-4" />
                  <p className="text-xl font-fraunces">Tu carrito está vacío</p>
                  <p className="text-sm">¡Explora la plaza y agrega algo rico!</p>
                </div>
              ) : (
                <>
                  {storesInCart.length > 1 && (
                    <div className="bg-warnl p-4 rounded-2xl border border-warn/20 flex gap-3">
                      <Bell className="w-6 h-6 text-warn shrink-0" />
                      <p className="text-xs text-warn font-medium">
                        Tu pedido contiene productos de {storesInCart.length} tiendas diferentes. Se generarán pedidos por separado.
                      </p>
                    </div>
                  )}

                  {cartByStore.map(group => (
                    <div key={group.store.id} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-mm-crd pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-mm-gbg rounded-lg overflow-hidden border border-mm-crd shrink-0">
                            {group.store.image ? (
                              <img src={group.store.image} alt={group.store.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-mm-gbg text-mm-txw text-xs">ST</div>
                            )}
                          </div>
                          <span className="font-bold text-mm-g">{group.store.name}</span>
                          <Badge variant="oro" className="text-[10px]">Local {group.store.local}</Badge>
                        </div>
                        <span className="text-xs font-bold text-mm-txs">
                          Subtotal: {fmt(group.items.reduce((acc, i) => acc + (getPrice(i) * i.qty), 0))}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {group.items.map(item => (
                          <div key={item.id} className="flex gap-4 group">
                            <div className="w-16 h-16 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl shrink-0 overflow-hidden border border-mm-crd/50">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-6 h-6 text-mm-txw" />
                              )}
                            </div>
                            <div className="flex-grow">
                              <div className="flex justify-between items-start">
                                <h4 className="font-bold text-mm-g text-sm">{item.name}</h4>
                                <button
                                  onClick={() => dispatch({ type: 'REMOVE_FROM_CART', productId: item.id })}
                                  className="text-mm-txw hover:text-r transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-xs text-mm-txs mb-2">{fmt(getPrice(item))} / {item.unit}</p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center bg-mm-gbg rounded-xl p-1 gap-1">
                                  <input
                                    type="number"
                                    step={itemModes[item.id] === 'alt' ? "1" : "0.01"}
                                    min="0"
                                    value={itemModes[item.id] === 'alt' && item.unit === 'kg' ? Math.round(item.qty * 1000) : item.qty}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const realQty = itemModes[item.id] === 'alt' && item.unit === 'kg' ? val / 1000 : val;
                                      dispatch({ type: 'UPDATE_CART_QTY', productId: item.id, qty: realQty });
                                    }}
                                    className="w-16 bg-white border-none rounded-lg py-1 px-2 text-[10px] font-bold text-center appearance-none focus:ring-1 ring-mm-g/20"
                                  />
                                  {item.unit === 'kg' ? (
                                    <button
                                      onClick={() => toggleItemMode(item.id)}
                                      className="px-2 py-1 bg-white rounded-lg text-[9px] font-black uppercase text-mm-g hover:bg-mm-gll transition-colors min-w-[28px] border border-mm-crd/50"
                                    >
                                      {itemModes[item.id] === 'alt' ? 'g' : 'kg'}
                                    </button>
                                  ) : (
                                    <span className="text-[9px] font-bold text-mm-txw px-2 py-1 uppercase">{item.unit}</span>
                                  )}
                                </div>
                                <span className="font-bold text-mm-g text-sm">{fmt(getPrice(item) * item.qty)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {state.cart.length > 0 && (
              <div className="p-6 border-t border-mm-crd bg-mm-gbg/30 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-mm-txs">
                      <MapPin className="w-4 h-4" /> Entrega en:
                    </div>
                    <span className="font-bold text-mm-g">{defaultAddress?.label || 'Seleccionar...'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-mm-txs">
                      <CreditCard className="w-4 h-4" /> Pago con:
                    </div>
                    <span className="font-bold text-mm-g">{state.buyerProfile.payments.find(p => p.isDefault)?.label || 'Efectivo'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-mm-crd">
                  <span className="text-lg font-fraunces text-mm-g">Total a pagar</span>
                  <span className="text-2xl font-fraunces text-mm-g">{fmt(total)}</span>
                </div>

                <Button onClick={handlePlaceOrder} className="w-full py-4 text-lg" size="lg">
                  {storesInCart.length > 1 ? `Confirmar ${storesInCart.length} pedidos` : 'Confirmar pedido'}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
