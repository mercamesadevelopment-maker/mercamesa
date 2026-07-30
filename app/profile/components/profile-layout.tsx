'use client';

import { useState, useEffect } from 'react';
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
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'addresses', icon: MapPin, label: 'Direcciones' },
  { id: 'payments', icon: CreditCard, label: 'Pagos' },
  { id: 'ratings', icon: Star, label: 'Calificar' },
  { id: 'favorites', icon: Heart, label: 'Favoritos' },
  { id: 'prefs', icon: Settings, label: 'Preferencias' },
  { id: 'account', icon: User, label: 'Mi cuenta' },
];

export function ProfileLayout() {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Sync with global section navigation (e.g. Shell redirects to ratings)
  useEffect(() => {
    if (state.currentSection === 'profile_ratings') {
      setActiveTab('ratings');
    } else if (state.currentSection === 'profile_account') {
      setActiveTab('account');
    }
  }, [state.currentSection]);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <nav className="w-full md:w-64 shrink-0 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all font-bold text-sm',
                activeTab === tab.id
                  ? 'bg-mm-g text-white shadow-lg'
                  : 'bg-white text-mm-txs border border-mm-crd hover:border-mm-g'
              )}
            >
              <tab.icon className="w-5 h-5" />
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
