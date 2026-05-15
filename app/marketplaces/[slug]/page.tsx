'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, MapPin, Clock, Phone, Mail, Compass, Globe, Star, Zap, Store as StoreIcon, ChevronRight } from 'lucide-react';
import { Badge } from '@/src/components/Shared';
import { Database } from '@/types/database_generated';

type MarketplaceDetail = Database['public']['Views']['marketplaces_detail']['Row'] & {
  coverSignedUrl?: string | null;
  logoSignedUrl?: string | null;
  stores?: any[];
};

export default function PlazaDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [plaza, setPlaza] = useState<MarketplaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/marketplaces/detail/${slug}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);
        
        setPlaza(data.data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error fetching plaza details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetail();
  }, [slug]);

  if (loading) return <div className="p-12 text-center text-mm-txs">Cargando plaza...</div>;
  if (error || !plaza) return <div className="p-12 text-center text-r">{error || 'No encontrada'}</div>;

  return (
    <div className="px-4 lg:px-8 max-w-7xl mx-auto py-8 animate-fade-up pb-24">
      <button 
        onClick={() => router.push('/marketplaces')}
        className="flex items-center gap-2 text-mm-g font-bold mb-6 hover:translate-x-1 transition-transform"
      >
        <ArrowLeft className="w-5 h-5" /> Volver a plazas
      </button>

      <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm mb-10 flex flex-col md:flex-row gap-8 items-center overflow-hidden relative">
        <div className="w-32 h-32 rounded-3xl flex items-center justify-center shrink-0 overflow-hidden bg-mm-gbg border border-mm-crd/30">
          {plaza.logoSignedUrl ? (
            <img src={plaza.logoSignedUrl} alt={plaza.name || 'Logo'} className="w-full h-full object-cover p-2" />
          ) : (
            <StoreIcon className="w-12 h-12 text-mm-txw" />
          )}
        </div>
        
        <div className="flex-grow">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-4xl font-fraunces text-mm-g">{plaza.name}</h1>
            <Badge variant={plaza.is_active ? 'success' : 'error'}>
              {plaza.is_active ? 'Abierta' : 'Inactiva'}
            </Badge>
          </div>
          
          <p className="text-mm-txs mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> {plaza.address ? `${plaza.address}, ` : ''}{plaza.city}, {plaza.department}
          </p>
          
          {plaza.description && (
            <p className="text-sm text-mm-txs max-w-2xl mb-4">{plaza.description}</p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 pt-6 border-t border-mm-crd/50 text-xs text-mm-txs">
            {plaza.latitude && plaza.longitude && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${plaza.latitude},${plaza.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:bg-mm-gbg p-1 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center">
                  <Compass className="w-4 h-4 text-mm-g" />
                </div>
                <div>
                  <p className="font-bold text-mm-txw uppercase text-[8px] leading-tight">Ubicación</p>
                  <p className="font-medium">Ver en Mapa</p>
                </div>
              </a>
            )}
          </div>
        </div>
        
        <div className="text-center md:text-right">
          <div className="text-3xl font-bold text-mm-oro flex items-center justify-center md:justify-end gap-2 mb-1">
            <Star className="w-8 h-8 fill-mm-oro" /> 5.0
          </div>
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Calificación</p>
        </div>
      </div>

      {/* Stores List */}
      <div className="mb-10">
        <h2 className="text-2xl font-fraunces text-mm-g mb-6">Tiendas ({plaza.stores_count || 0})</h2>
        {plaza.stores && plaza.stores.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plaza.stores.map((store: any) => (
              <motion.div
                key={store.id}
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 bg-mm-gbg rounded-2xl flex items-center justify-center shrink-0 border border-mm-crd/30 overflow-hidden group-hover:scale-105 transition-transform">
                    {store.logoSignedUrl ? (
                      <img src={store.logoSignedUrl} alt={store.name} className="w-full h-full object-cover" />
                    ) : (
                      <StoreIcon className="w-6 h-6 text-mm-txw" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-mm-g leading-tight">{store.name}</h3>
                    <p className="text-[10px] text-mm-txw font-bold uppercase mt-1">{store.contact_name}</p>
                  </div>
                </div>
                
                {store.description && (
                  <p className="text-xs text-mm-txs line-clamp-2 mb-4">{store.description}</p>
                )}
                
                <div className="pt-4 border-t border-mm-gbg flex items-center justify-between">
                  <div className="flex items-center gap-1 text-mm-oro text-xs font-bold">
                    <Star className="w-3 h-3 fill-mm-oro" /> {(store.reputation_score || 5.0).toFixed(1)}
                  </div>
                  <button className="text-xs font-bold text-mm-g hover:underline flex items-center gap-1">
                    Visitar Tienda <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 bg-mm-gbg/30 rounded-3xl border border-mm-crd text-center text-mm-txw">
            Aún no hay tiendas registradas en esta plaza.
          </div>
        )}
      </div>
    </div>
  );
}
