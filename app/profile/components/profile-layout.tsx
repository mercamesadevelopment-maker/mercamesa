'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { useApp } from '@/src/store';
import { cn } from '@/src/components/Shared';
import {
  LayoutDashboard,
  MapPin,
  CreditCard,
  Star,
  Heart,
  Settings,
  User,
} from 'lucide-react';

import { DashboardTab } from './dashboard-tab';
import { AddressesTab } from './addresses-tab';
import { PaymentsTab } from './payments-tab';
import { RatingsTab } from './ratings-tab';
import { FavoritesTab } from './favorites-tab';
import { PreferencesTab } from './preferences-tab';
import { AccountTab } from './account-tab';

type TabId = 'dashboard' | 'addresses' | 'payments' | 'ratings' | 'favorites' | 'prefs' | 'account';

const TABS: { id: TabId; icon: React.ElementType; label: string }[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { id: 'addresses', icon: MapPin, label: 'Direcciones' },
  { id: 'payments', icon: CreditCard, label: 'Pagos' },
  { id: 'ratings', icon: Star, label: 'Calificar' },
  { id: 'favorites', icon: Heart, label: 'Favoritos' },
  { id: 'prefs', icon: Settings, label: 'Preferencias' },
  { id: 'account', icon: User, label: 'Mi cuenta' },
];

const BUYER_ONLY_TABS: TabId[] = ['addresses', 'payments', 'ratings', 'favorites'];

export function ProfileLayout() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const isBuyer = state.userRole === 'retail' || state.userRole === 'wholesale';
  const visibleTabs = isBuyer ? TABS : TABS.filter((tab) => !BUYER_ONLY_TABS.includes(tab.id));
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  // Sync with global section navigation (e.g. Shell redirects to ratings)
  useEffect(() => {
    if (state.currentSection === 'profile_ratings') {
      setActiveTab(isBuyer ? 'ratings' : 'dashboard');
    } else if (state.currentSection === 'profile_account') {
      setActiveTab('account');
    }
  }, [state.currentSection, isBuyer]);

  // En móvil las pestañas son una fila deslizable: si se llega a "Mi cuenta"
  // desde fuera, la pestaña activa quedaría fuera de la vista. `block: 'nearest'`
  // evita que la página salte en vertical; en escritorio no mueve nada.
  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-5 md:gap-8">
        {/* Sidebar. Por debajo de `md` es una fila deslizable: apilados, los 7
            botones ocupaban ~370px y el contenido de la pestaña quedaba por
            debajo del borde, así que tocar una parecía no hacer nada. */}
        <nav className="flex md:flex-col gap-2 md:gap-1 w-auto md:w-64 shrink-0 overflow-x-auto md:overflow-visible scrollbar-hide -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              ref={activeTab === tab.id ? activeButtonRef : undefined}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={cn(
                'shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 py-2.5 md:px-5 md:py-3.5 rounded-full md:rounded-2xl transition-all font-bold text-sm whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-mm-g text-white shadow-lg'
                  : 'bg-white text-mm-txs border border-mm-crd hover:border-mm-g'
              )}
            >
              <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <DashboardTab key="dashboard" />}
            {activeTab === 'addresses' && <AddressesTab key="addresses" />}
            {activeTab === 'payments' && <PaymentsTab key="payments" />}
            {activeTab === 'ratings' && <RatingsTab key="ratings" />}
            {activeTab === 'favorites' && <FavoritesTab key="favorites" />}
            {activeTab === 'prefs' && <PreferencesTab key="prefs" />}
            {activeTab === 'account' && <AccountTab key="account" />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
