import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { usePublicMarketplaces } from '../hooks/usePublicMarketplaces';
import { PlazaCard } from './PlazaCard';

export function PlazaList() {
  const router = useRouter();
  const { marketplaces, loading, error } = usePublicMarketplaces();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlazas = marketplaces.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-12 text-center text-mm-txs">Cargando plazas...</div>;
  if (error) return <div className="p-12 text-center text-r">Error: {error}</div>;

  return (
    <motion.div 
      key="plazas"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="px-4 lg:px-8 max-w-7xl mx-auto pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-display text-mm-g mb-2">Explora las Plazas</h1>
          <p className="text-mm-txs">Encuentra los mejores productos frescos directamente de la fuente.</p>
        </div>
        <div className="relative w-full max-w-md mx-auto md:mx-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
          <input 
            type="text" 
            placeholder="Buscar plaza o ciudad..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredPlazas.map(plaza => (
          <PlazaCard
            key={plaza.id}
            plaza={plaza}
            onOpen={() => router.push(`/marketplaces/${plaza.slug}`)}
          />
        ))}
      </div>
      
      {filteredPlazas.length === 0 && (
        <div className="py-20 text-center text-mm-txw">
          No encontramos plazas con esa búsqueda.
        </div>
      )}
    </motion.div>
  );
}
