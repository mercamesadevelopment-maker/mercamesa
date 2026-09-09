'use client';

import { useState } from 'react';
import { Clock, Loader2, Star, Store, Info } from 'lucide-react';
import { useSellerStore } from '@/app/hooks/use-seller-store';
import { StoreHoursTab } from './components/store-hours-tab';
import { StoreProfileTab } from './components/store-profile-tab';
import { StoreReputationTab } from './components/store-reputation-tab';

type TabKey = 'profile' | 'hours' | 'reputation';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'profile', label: 'Datos de la tienda', icon: Store },
  { key: 'hours', label: 'Horario', icon: Clock },
  { key: 'reputation', label: 'Calificaciones', icon: Star },
];

export default function SellerSettingsPage() {
  const { stores, storeId, storeName, loading: loadingStore, error, selectStore } = useSellerStore();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  if (loadingStore) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  // Sin tienda asociada no hay nada que configurar. Antes el hook caía a "la
  // primera tienda de la base", lo que aquí sería editar una tienda ajena.
  if (!storeId) {
    return (
      <div className="p-6 lg:p-10 max-w-2xl mx-auto">
        <div className="rounded-3xl border border-mm-crd bg-white p-8 text-center">
          <Info className="mx-auto mb-4 h-10 w-10 text-mm-txw" />
          <h1 className="mb-2 text-2xl font-fraunces text-mm-g">Aún no tienes una tienda</h1>
          <p className="text-sm text-mm-txs">
            {error ||
              'Tu usuario no está asociado a ninguna tienda. Pídele al equipo de MercaMesa que te asocie a la tuya.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-mm-gbg flex items-center justify-center text-mm-g">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-fraunces text-mm-g">Mi Tienda</h1>
            <p className="text-sm text-mm-txs">{storeName}</p>
          </div>
        </div>

        {stores.length > 1 && (
          <select
            value={storeId ?? ''}
            onChange={(e) => selectStore(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm text-mm-g cursor-pointer"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-mm-crd/50 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-mm-g text-white shadow-md shadow-mm-g/20 scale-[1.02]'
                  : 'bg-white text-mm-txs hover:text-mm-g hover:bg-mm-gbg/60 border border-mm-crd/30'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-mm-txw'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
        {activeTab === 'profile' && <StoreProfileTab storeId={storeId} />}
        {activeTab === 'hours' && <StoreHoursTab storeId={storeId} />}
        {activeTab === 'reputation' && <StoreReputationTab storeId={storeId} />}
      </div>
    </div>
  );
}
