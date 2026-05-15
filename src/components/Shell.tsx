import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { C, fmt } from '../constants';
import { CartItem } from '../types';
import { Button, Badge, cn } from './Shared';
import {
  ShoppingCart,
  Bell,
  User,
  LogOut,
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  ChevronDown,
  Trash2,
  MapPin,
  CreditCard,
  Leaf,
  X,
  Image as ImageIcon,
} from 'lucide-react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function Topbar({
  onCartOpen,
  onToggleSidebar,
}: {
  onCartOpen: () => void;
  onToggleSidebar: () => void;
}) {
  const { state } = useApp();
  const router = useRouter();

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const cartCount = state.cart.reduce(
    (acc, item) => acc + item.qty,
    0
  );

  const unreadNotifs = state.notifs.filter(
    n => !n.read
  ).length;

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

          <span className="text-xl font-bold font-fraunces hidden sm:block">
            Mercamesa
          </span>
        </div>
      </div>

      <div className="flex-grow max-w-xl mx-8 hidden lg:block text-mm-gll font-medium text-sm tracking-wide">
        {state.userRole === 'admin'
          ? 'PANEL DE ADMINISTRACIÓN'
          : state.userRole === 'provider'
            ? 'GESTIÓN DE PROVEEDOR'
            : state.userRole === 'delivery'
              ? 'CENTRO DE REPARTO'
              : 'MARKETPLACE MERCAMESA'}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
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
            onClick={() =>
              setShowProfileMenu(!showProfileMenu)
            }
            className="flex items-center gap-2 pl-2 border-l border-white/20 ml-2 hover:bg-white/10 p-1 rounded-xl transition-all"
          >
            {state.buyerProfile.avatar ? (
  <img
    src={state.buyerProfile.avatar}
    alt="Profile"
    className="w-full h-full object-cover"
    referrerPolicy="no-referrer"
  />
) : (
  <User className="w-5 h-5 text-white" />
)}

            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold leading-none">
                {state.buyerProfile.name}
              </p>

              <p className="text-[10px] text-mm-gll uppercase font-bold tracking-tighter">
                {state.userRole}
              </p>
            </div>

            <ChevronDown
              className={cn(
                'w-4 h-4 text-mm-gll transition-transform',
                showProfileMenu && 'rotate-180'
              )}
            />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() =>
                    setShowProfileMenu(false)
                  }
                />

                <motion.div
                  initial={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    y: 10,
                    scale: 0.95,
                  }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-mm-crd z-50 overflow-hidden py-2"
                >
                  <div className="px-4 py-3 border-b border-mm-crd mb-2">
                    <p className="text-xs text-mm-txw font-bold uppercase tracking-widest leading-none mb-1">
                      Tu Cuenta
                    </p>

                    <p className="text-sm font-bold text-mm-g truncate">
                      {state.buyerProfile.name}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      router.push('/profile');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-mm-txs hover:bg-mm-gbg hover:text-mm-g flex items-center gap-2 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Mi Perfil
                  </button>

                  <button
                    onClick={() => {
                      router.push('/support');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-mm-txs hover:bg-mm-gbg hover:text-mm-g flex items-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ayuda y Soporte
                  </button>

                  <div className="h-px bg-mm-crd my-2" />

                  <button
                    onClick={async () => {
                      const supabase =
                        createSupabaseBrowserClient();

                      await supabase.auth.signOut();

                      router.push('/');

                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-r hover:bg-rl flex items-center gap-2 transition-colors font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
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

export function Sidebar({
  collapsed,
}: {
  collapsed: boolean;
}) {
  return (
    <DynamicSidebar collapsed={collapsed} />
  );
}

export function CartPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { state, dispatch } = useApp();

  const router = useRouter();

  const storesInCart = Array.from(
    new Set(state.cart.map(i => i.storeId))
  );

  const cartByStore = storesInCart.map(storeId => ({
    store: state.stores.find(
      s => s.id === storeId
    )!,
    items: state.cart.filter(
      i => i.storeId === storeId
    ),
  }));

  const isWS = state.userRole === 'wholesale';

  const getPrice = (item: CartItem) =>
    isWS ? item.wsPrice : item.retailPrice;

  const total = state.cart.reduce(
    (acc, item) =>
      acc + getPrice(item) * item.qty,
    0
  );

  const defaultAddress =
    state.buyerProfile.addresses.find(
      a => a.isDefault
    );

  const [itemModes, setItemModes] = useState<
    Record<number, 'base' | 'alt'>
  >({});

  const toggleItemMode = (id: number) => {
    setItemModes(prev => ({
      ...prev,
      [id]:
        prev[id] === 'alt'
          ? 'base'
          : 'alt',
    }));
  };

  const handlePlaceOrder = async () => {
    try {
      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const buyerId = user.id;

      // For each store in cart, create an order
      for (const group of cartByStore) {
        const orderData = {
          buyer_id: buyerId,
          buyer_type:
            state.userRole === 'wholesale'
              ? 'wholesale'
              : 'retail',
          status: 'pending',
          subtotal: group.items.reduce(
            (acc, i) => acc + getPrice(i) * i.qty,
            0
          ),
          delivery_fee: 5000,
          discount: 0,
          total:
            group.items.reduce(
              (acc, i) => acc + getPrice(i) * i.qty,
              0
            ) + 5000,
          notes: 'Pedido desde la web',
        };

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error(err);
          throw new Error('Error creating order');
        }

        const { data: order } =
          await response.json();

        const orderItems = group.items.map(i => ({
          order_id: order.id,
          store_product_id: i.id,
          quantity: i.qty,
          unit_price: getPrice(i),
          total_price: getPrice(i) * i.qty,
          catalog_name: i.name,
          unit_name: i.unit || 'und',
        }));

        await fetch('/api/order-items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderItems),
        });
      }

      dispatch({ type: 'CLEAR_CART' });

      alert('¡Pedido realizado con éxito!');

      router.push('/orders');

      onClose();
    } catch (error) {
      console.error(error);
      alert(
        'Hubo un error procesando el pedido.'
      );
    }
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
            className="fixed inset-0 bg-mm-g/40 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[210] flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-mm-gbg">
              <h2 className="text-2xl font-fraunces text-mm-g flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" /> Tu Canasta
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-mm-gbg rounded-full transition-colors">
                <X className="w-5 h-5 text-mm-txs" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {cartByStore.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-mm-txw opacity-60">
                  <ShoppingBag className="w-16 h-16 mb-4" />
                  <p className="font-medium text-lg">Tu canasta está vacía</p>
                </div>
              ) : (
                cartByStore.map(group => (
                  <div key={group.store.id} className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-mm-gbg">
                      <span className="text-xl">{group.store.emoji}</span>
                      <h3 className="font-bold text-mm-g">{group.store.name}</h3>
                    </div>
                    {group.items.map(item => (
                      <div key={item.id} className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-mm-gbg rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden border border-mm-crd/30">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            item.emoji
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="font-bold text-mm-g text-sm leading-tight mb-1">{item.name}</p>
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-mm-g">{fmt(getPrice(item))}</p>
                            <div className="flex items-center gap-3 bg-mm-gbg rounded-full px-2 py-1">
                              <button
                                onClick={() => dispatch({ type: 'UPDATE_CART_QTY', productId: item.id, qty: Math.max(0, item.qty - 1) })}
                                className="w-6 h-6 flex items-center justify-center font-bold text-mm-txs hover:text-mm-g hover:bg-white rounded-full transition-colors"
                              >-</button>
                              <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                              <button
                                onClick={() => dispatch({ type: 'UPDATE_CART_QTY', productId: item.id, qty: item.qty + 1 })}
                                className="w-6 h-6 flex items-center justify-center font-bold text-mm-txs hover:text-mm-g hover:bg-white rounded-full transition-colors"
                              >+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {cartByStore.length > 0 && (
              <div className="p-6 bg-mm-gbg/50 border-t border-mm-crd/30">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-mm-txs text-sm">
                    <span>Subtotal</span>
                    <span className="font-bold">{fmt(total)}</span>
                  </div>
                  <div className="flex justify-between text-mm-txs text-sm">
                    <span>Costo de envío estimado</span>
                    <span className="font-bold">{fmt(5000 * cartByStore.length)}</span>
                  </div>
                  <div className="pt-3 border-t border-mm-crd/50 flex justify-between items-center">
                    <span className="font-bold text-mm-g">Total</span>
                    <span className="text-2xl font-bold text-mm-g">{fmt(total + (5000 * cartByStore.length))}</span>
                  </div>
                </div>
                <Button onClick={handlePlaceOrder} className="w-full py-4 text-lg">
                  Confirmar Pedido
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}