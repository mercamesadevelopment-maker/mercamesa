/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from './store';
import { cn } from './components/Shared';
import { Topbar, CartPanel } from './components/Shell';
import { Sidebar } from '../components/ui/shell/components/Sidebar';
import { MarketView, AllPlazasView, AllStoresView, AllProductsView, AllOffersView } from './components/Marketplace';
import { OrdersView, BuyerProfileView, SupportChatView } from './components/UserViews';
import { ProviderDashboard, ProviderProductsView, WhatsAppBot, AdminView, ProviderSalesView, ProviderSalesHistoryView, ProviderReputationView, ProviderOrdersView } from './components/AdminViews';
import { DeliveryView, NotifsView, EarningsView } from './components/DeliveryNotifs';
import { RoleKey } from './types';
import MarketplacesAdmin from '../app/admin/marketplaces/page';

export default function MercamesaContent() {
  const { state, dispatch } = useApp();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Splash screen effect
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Periodic notification simulation
  useEffect(() => {
    if (!state.isLoggedIn) return;

    const interval = setInterval(() => {
      const types: ('order_new' | 'price_update' | 'rating' | 'payment')[] = ['order_new', 'price_update', 'rating', 'payment'];
      const type = types[Math.floor(Math.random() * types.length)];
      const titles = {
        order_new: "¡Nuevo pedido recibido!",
        price_update: "Precio actualizado",
        rating: "Nueva calificación ⭐",
        payment: "Pago confirmado ✅"
      };
      const msgs = {
        order_new: "Tienes un nuevo pedido de la Plaza Minorista.",
        price_update: "El precio del Tomate Chonto ha bajado un 5%.",
        rating: "Un cliente calificó tu tienda con 5 estrellas.",
        payment: "Tu pago por $45.000 ha sido procesado con éxito."
      };

      dispatch({
        type: 'ADD_NOTIF',
        notif: {
          id: Date.now().toString(),
          type,
          title: titles[type],
          msg: msgs[type],
          time: "Ahora",
          read: false
        }
      });
    }, 25000);

    return () => clearInterval(interval);
  }, [state.isLoggedIn, dispatch]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#1C2B0E] flex flex-col items-center justify-center z-[9999]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="text-7xl mb-6"
        >
          🌿
        </motion.div>
        <h1 className="text-3xl font-fraunces font-bold text-mm-oro">Mercamesa</h1>
        <p className="text-white/40 text-sm mt-4 animate-pulse">Preparando la plaza...</p>
        <div className="w-48 h-1 bg-white/10 rounded-full mt-8 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2 }}
            className="h-full bg-mm-gll"
          />
        </div>
      </div>
    );
  }


  const renderContent = () => {
    // Safety check: Ensure current section is valid for role
    const section = state.currentSection;
    const role = state.userRole;

    // Buyer Views (Retail/Wholesale)
    if (role === 'retail' || role === 'wholesale') {
      switch (section) {
        case 'home': return <MarketView />;
        case 'all_plazas': return <AllPlazasView />;
        case 'all_stores': return <AllStoresView />;
        case 'all_products': return <AllProductsView />;
        case 'promotions': return <AllOffersView />;
        case 'orders': return <OrdersView />;
        case 'profile':
        case 'profile_ratings': return <BuyerProfileView />;
        case 'support': return <SupportChatView />;
        default: return <MarketView />;
      }
    }

    // Provider Views
    if (role === 'provider') {
      switch (section) {
        case 'dashboard': return <ProviderDashboard />;
        case 'products': return <ProviderProductsView />;
        case 'reputation': return <ProviderReputationView />;
        case 'orders': return <ProviderOrdersView />;
        case 'whatsapp': return <WhatsAppBot />;
        case 'analytics': return <ProviderDashboard />; // Using dashboard as analytics fallback
        case 'sales': return <ProviderSalesView />;
        case 'sales_history': return <ProviderSalesHistoryView />;
        case 'profile': return <BuyerProfileView />;
        default: return <ProviderDashboard />;
      }
    }

    // Delivery Views
    if (role === 'delivery') {
      switch (section) {
        case 'routes': return <DeliveryView />;
        case 'history': return <OrdersView />;
        case 'earnings': return <EarningsView />;
        case 'profile': return <BuyerProfileView />;
        default: return <DeliveryView />;
      }
    }

    // Admin Views
    if (role === 'admin') {
      switch (section) {
        case 'admin_plazas': return <MarketplacesAdmin />;
        case 'admin_stores': return <AdminView />;
        case 'admin_products': return <AdminView />;
        case 'admin_reputation': return <AdminView />;
        case 'admin_offers': return <AdminView />;
        case 'admin_orders': return <AdminView />;
        case 'admin_analytics': return <AdminView />;
        case 'admin_notifs': return <NotifsView />;
        case 'profile': return <BuyerProfileView />;
        default: return <AdminView />;
      }
    }

    return <MarketView />;
  };

  return (
    <div className="min-h-screen bg-[#FAFAF5]">
      <Topbar onCartOpen={() => setIsCartOpen(true)} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <Sidebar collapsed={sidebarCollapsed} />
      <main className={cn(
        "pt-16 min-h-screen transition-all duration-300",
        sidebarCollapsed ? "pl-20" : "pl-64"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentSection + state.userRole}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
      <CartPanel isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}



