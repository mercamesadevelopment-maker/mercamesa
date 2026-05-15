'use client';
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Store as StoreIcon, Building2 } from 'lucide-react';
import { Badge, cn } from '@/src/components/Shared';
import { usePublicMarketplaces } from '../../marketplaces/hooks/usePublicMarketplaces';

export default function MarketplacesSectionPage() {
  const router = useRouter();
  const { marketplaces, loading, error } = usePublicMarketplaces();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('Todas');

  const cities = ['Todas', ...Array.from(new Set(marketplaces.map(p => p.city)))];

  const filteredPlazas = marketplaces.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.address || '').toLowerCase().includes(search.toLowerCase());
    const matchesCity = city === 'Todas' || p.city === city;
    return matchesSearch && matchesCity;
  });

  if (loading) return <div className="p-12 text-center text-mm-txs">Cargando plazas...</div>;
  if (error) return <div className="p-12 text-center text-r">Error: {error}</div>;

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-up">
      <div>
        <h1 className="text-4xl font-fraunces text-mm-g mb-2">Todas las Plazas</h1>
        <p className="text-mm-txs">Explora los centros de abastecimiento más frescos de la región.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o dirección..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {cities.map(c => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap",
                city === c ? "bg-mm-g text-white shadow-md" : "bg-white border border-mm-crd text-mm-txs hover:border-mm-g"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredPlazas.map(plaza => (
          <motion.div
            key={plaza.id}
            whileHover={{ y: -8 }}
            onClick={() => router.push(`/marketplaces/${plaza.slug}`)}
            className="bg-white rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group flex flex-col"
          >
            <div className="h-40 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform overflow-hidden relative bg-mm-gbg">
              {plaza.coverSignedUrl ? (
                <img src={plaza.coverSignedUrl} alt={plaza.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-12 h-12 text-mm-crd" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-4 left-4 w-12 h-12 bg-white rounded-xl p-1 shadow-md">
                {plaza.logoSignedUrl ? (
                  <img src={plaza.logoSignedUrl} alt={plaza.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <Building2 className="w-full h-full text-mm-txw p-2" />
                )}
              </div>
            </div>
            <div className="p-6 flex-grow flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-mm-g font-fraunces leading-tight">{plaza.name}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-mm-txw mb-4">
                <MapPin className="w-3.5 h-3.5" /> {plaza.city} • {plaza.address}
              </div>
              
              <div className="mt-auto flex items-center justify-between pt-4 border-t border-mm-crd">
                <div className="flex items-center gap-2 text-xs font-bold text-mm-txs">
                  <StoreIcon className="w-4 h-4" /> Ver tiendas
                </div>
                <Badge variant={plaza.is_active ? 'success' : 'error'}>
                  {plaza.is_active ? 'Abierta' : 'Cerrada'}
                </Badge>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {filteredPlazas.length === 0 && (
        <div className="py-20 text-center text-mm-txw">
          No encontramos plazas con esos filtros.
        </div>
      )}
    </div>
  );
}
