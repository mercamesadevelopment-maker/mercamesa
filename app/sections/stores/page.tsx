'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Store as StoreIcon, Star, Heart } from 'lucide-react';
import { Badge, cn } from '@/src/components/Shared';
import { usePublicStores } from './hooks/usePublicStores';
import { usePublicMarketplaces } from '../../marketplaces/hooks/usePublicMarketplaces';
import { useApp } from '@/src/store';
import { useFavorites } from '@/src/features/favorites/hooks/use-favorites';

export default function StoresSectionPage() {
  const router = useRouter();
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
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-up pb-24">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Todas las Tiendas</h1>
        <p className="text-mm-txs">Nuestros expertos tenderos listos para servirte.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
            <input 
              type="text" 
              placeholder="Buscar tienda por nombre o especialidad..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
            />
          </div>
          <select 
            className="px-4 py-2.5 rounded-full border border-mm-crd text-sm outline-none focus:border-mm-g bg-white"
            value={plazaId}
            onChange={(e) => setPlazaId(e.target.value)}
          >
            <option value="all">Todas las Plazas</option>
            {marketplaces.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {allCategories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                activeCat === c ? "bg-mm-g text-white shadow-md" : "bg-white border border-mm-crd text-mm-txs hover:border-mm-g"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredStores.map(store => (
          <motion.div
            key={store.id}
            whileHover={{ y: -8 }}
            onClick={() => router.push(`/stores/${store.slug}`)}
            className="relative bg-white rounded-[32px] border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer p-6 flex flex-col group"
          >
            {state.isLoggedIn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(store.id);
                }}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-sm transition-all"
              >
                <Heart
                  className={cn(
                    'w-4.5 h-4.5 transition-colors',
                    isFavorite(store.id) ? 'fill-r text-r' : 'text-mm-txw'
                  )}
                />
              </button>
            )}

            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-mm-gbg rounded-2xl flex items-center justify-center shrink-0 border border-mm-crd/30 overflow-hidden group-hover:scale-105 transition-transform">
                {store.logoSignedUrl ? (
                  <img src={store.logoSignedUrl} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <StoreIcon className="w-6 h-6 text-mm-txw" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <Badge variant="oro" className="mb-1 text-[10px] uppercase font-bold tracking-widest block truncate">
                  {store.marketplaces?.name || 'Plaza'}
                </Badge>
                <h3 className="font-bold text-mm-g leading-tight truncate">{store.name}</h3>
              </div>
            </div>
            
            <p className="text-xs text-mm-txs line-clamp-2 mb-4 flex-grow">{store.description}</p>
            
            <div className="pt-4 border-t border-mm-gbg flex items-center justify-between">
              <div className="flex items-center gap-1 text-mm-oro text-xs font-bold">
                <Star className="w-4 h-4 fill-mm-oro" /> {(store.reputation_score || 5.0).toFixed(1)}
              </div>
              <Badge variant="success">Abierta</Badge>
            </div>
          </motion.div>
        ))}
      </div>
      {filteredStores.length === 0 && (
        <div className="py-20 text-center text-mm-txw">
          No encontramos tiendas con esos filtros.
        </div>
      )}
    </div>
  );
}
