import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, MapPin, Store as StoreIcon, Building2 } from 'lucide-react';
import { Badge } from '@/src/components/Shared';
import { usePublicMarketplaces } from '../hooks/usePublicMarketplaces';

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
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Explora las Plazas</h1>
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
          <motion.div
            key={plaza.id}
            whileHover={{ y: -8 }}
            onClick={() => router.push(`/marketplaces/${plaza.slug}`)}
            className="bg-white rounded-3xl border border-mm-crd shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group flex flex-col"
          >
            <div className="h-40 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform overflow-hidden relative bg-mm-gbg">
              {plaza.coverSignedUrl ? (
                <Image 
                  src={plaza.coverSignedUrl} 
                  alt={plaza.name} 
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                  loading="lazy"
                />
              ) : (
                <Building2 className="w-12 h-12 text-mm-crd" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-[1]" />
              <div className="absolute bottom-4 left-4 w-12 h-12 bg-white rounded-xl p-1 shadow-md z-[2] flex items-center justify-center">
                {plaza.logoSignedUrl ? (
                  <Image 
                    src={plaza.logoSignedUrl} 
                    alt={plaza.name} 
                    width={40} 
                    height={40} 
                    className="object-cover rounded-lg" 
                    loading="lazy"
                  />
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
                <MapPin className="w-3.5 h-3.5" /> {plaza.city}, {plaza.department}
              </div>
              
              <div className="mt-auto flex items-center justify-between pt-4 border-t border-mm-crd">
                <div className="flex items-center gap-2 text-xs font-bold text-mm-txs">
                  <StoreIcon className="w-4 h-4" /> Ver tiendas
                </div>
                <Badge variant="success">Abierta</Badge>
              </div>
            </div>
          </motion.div>
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
