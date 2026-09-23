'use client';
import React, { useEffect, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { usePublicStores } from './hooks/usePublicStores';
import { usePublicMarketplaces } from '../../marketplaces/hooks/usePublicMarketplaces';
import { useApp } from '@/src/store';
import { useFavorites } from '@/src/features/favorites/hooks/use-favorites';
import { StoreCard } from './components/StoreCard';

export default function StoresSectionPage() {
  const { state } = useApp();
  const { stores, loading: loadingStores, error } = usePublicStores();
  const { marketplaces, loading: loadingPlazas } = usePublicMarketplaces();
  const { isFavorite, toggleFavorite, fetchFavoriteIds } = useFavorites();

  const [search, setSearch] = useState('');
  const [plazaId, setPlazaId] = useState<string>('all');
  const [activeCat, setActiveCat] = useState('Todas');

  useEffect(() => {
    if (state.isLoggedIn) fetchFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isLoggedIn]);

  const loading = loadingStores || loadingPlazas;

  // Derive categories from active stores
  const allCategories = ['Todas', ...Array.from(new Set(stores.map(s => s.description || 'General'))).slice(0, 10)]; // Using description as category for now, or you could use a dedicated category field if it exists.

  const filteredStores = stores.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                          (s.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesPlaza = plazaId === 'all' || s.marketplace_id === plazaId;
    const matchesCat = activeCat === 'Todas' || s.description === activeCat;
    return matchesSearch && matchesPlaza && matchesCat;
  });

  if (loading) return <div className="p-12 text-center text-mm-txs">Cargando tiendas...</div>;
  if (error) return <div className="p-12 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-up pb-24">
      <div>
        <h1 className="text-3xl sm:text-4xl font-fraunces text-mm-g mb-1 sm:mb-2">Todas las Tiendas</h1>
        <p className="text-sm sm:text-base text-mm-txs">Nuestros expertos tenderos listos para servirte.</p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
            {/* text-base en móvil: iOS hace zoom al enfocar campos de menos de 16px. */}
            <input
              type="text"
              enterKeyHint="search"
              placeholder="Buscar tienda o especialidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-base sm:text-sm outline-none focus:border-mm-g transition-all"
            />
          </div>
          <select
            className="w-full sm:w-auto sm:min-w-56 px-4 py-2.5 rounded-full border border-mm-crd text-base sm:text-sm outline-none focus:border-mm-g bg-white"
            value={plazaId}
            onChange={(e) => setPlazaId(e.target.value)}
          >
            <option value="all">Todas las Plazas</option>
            {marketplaces.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {/* En móvil los chips llegan al borde de la pantalla en vez de cortarse en el padding. */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {allCategories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={cn(
                "shrink-0 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                activeCat === c ? "bg-mm-g text-white shadow-md" : "bg-white border border-mm-crd text-mm-txs hover:border-mm-g"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filteredStores.map(store => (
          <StoreCard
            key={store.id}
            store={store}
            isLoggedIn={state.isLoggedIn}
            isFavorite={isFavorite(store.id)}
            onToggleFavorite={() => toggleFavorite(store.id)}
          />
        ))}
      </div>
      {filteredStores.length === 0 && (
        <div className="py-12 sm:py-20 text-center text-mm-txw">
          No encontramos tiendas con esos filtros.
        </div>
      )}
    </div>
  );
}
