'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Search, Store as StoreIcon, Star, Phone, ShoppingCart, MapPin } from 'lucide-react';
import { Badge, cn } from '@/src/components/Shared';
import { usePublicProducts } from '@/app/sections/products/hooks/usePublicProducts';
import { useApp } from '@/src/store';

export default function StoreDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { dispatch } = useApp();

  const [store, setStore] = useState<any>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We fetch products based on store id once store is loaded
  const storeId = store?.id;
  const { products, loading: loadingProducts } = usePublicProducts(storeId);

  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('Todas');

  useEffect(() => {
    if (!slug) return;
    
    const fetchDetail = async () => {
      try {
        setLoadingStore(true);
        const res = await fetch(`/api/stores/detail/${slug}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);
        
        setStore(data.data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error fetching store details');
      } finally {
        setLoadingStore(false);
      }
    };
    
    fetchDetail();
  }, [slug]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.catalog_products?.categories?.name) {
        cats.add(p.catalog_products.categories.name);
      }
    });
    return ['Todas', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.catalog_products?.name?.toLowerCase().includes(search.toLowerCase()) || false;
      const matchCat = activeCat === 'Todas' || p.catalog_products?.categories?.name === activeCat;
      return matchSearch && matchCat;
    });
  }, [products, search, activeCat]);

  const handleAddToCart = (e: React.MouseEvent, p: any) => {
    e.stopPropagation();
    dispatch({
      type: 'ADD_TO_CART',
      product: {
        id: p.id,
        name: p.catalog_products?.name || 'Producto',
        cat: p.catalog_products?.categories?.name || 'Sin Categoría',
        retailPrice: p.price_per_unit || 0,
        wsPrice: p.price_per_unit || 0,
        stock: 100, // mock
        unit: p.measurement_units?.abbreviation || 'und',
        emoji: '📦',
        image: p.imageSignedUrl || null,
        plazaId: store?.marketplace_id || 1,
        storeId: store?.id,
        storeName: store?.name || 'Tienda'
      } as any
    });
  };

  const fmt = (val: number) => `$${val.toLocaleString('es-CO')}`;

  if (loadingStore) return <div className="p-12 text-center text-mm-txs">Cargando tienda...</div>;
  if (error || !store) return <div className="p-12 text-center text-r">{error || 'No encontrada'}</div>;

  return (
    <div className="px-4 lg:px-8 max-w-7xl mx-auto py-8 animate-fade-up pb-24">
      <button 
        onClick={() => router.push('/sections/stores')}
        className="flex items-center gap-2 text-mm-g font-bold mb-6 hover:translate-x-1 transition-transform"
      >
        <ArrowLeft className="w-5 h-5" /> Volver a tiendas
      </button>

      {/* Store Header */}
      <div className="bg-white p-8 rounded-[32px] border border-mm-crd shadow-sm mb-10 flex flex-col md:flex-row gap-8 items-center overflow-hidden relative">
        <div className="w-32 h-32 rounded-3xl flex items-center justify-center shrink-0 overflow-hidden bg-mm-gbg border border-mm-crd/30">
          {store.logoSignedUrl ? (
            <img src={store.logoSignedUrl} alt={store.name} className="w-full h-full object-cover p-2" />
          ) : (
            <StoreIcon className="w-12 h-12 text-mm-txw" />
          )}
        </div>
        
        <div className="flex-grow text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-2">
            <h1 className="text-4xl font-fraunces text-mm-g">{store.name}</h1>
            <Badge variant={store.is_active ? 'success' : 'error'} className="mt-1">
              {store.is_active ? 'Abierta' : 'Cerrada'}
            </Badge>
          </div>
          
          <p className="text-mm-txs mb-2 flex items-center justify-center md:justify-start gap-2">
            <MapPin className="w-4 h-4" /> {store.marketplaces?.name || 'Plaza Central'}
          </p>
          
          {store.description && (
            <p className="text-sm text-mm-txs max-w-2xl mb-4">{store.description}</p>
          )}

          {store.contact_phone && (
             <p className="text-sm text-mm-txs flex items-center justify-center md:justify-start gap-2">
               <Phone className="w-4 h-4" /> {store.contact_phone}
             </p>
          )}
        </div>
        
        <div className="text-center md:text-right shrink-0">
          <div className="text-3xl font-bold text-mm-oro flex items-center justify-center md:justify-end gap-2 mb-1">
            <Star className="w-8 h-8 fill-mm-oro" /> {(store.reputation_score || 5.0).toFixed(1)}
          </div>
          <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Calificación</p>
        </div>
      </div>

      {/* Store Products */}
      <div className="mb-8">
        <h2 className="text-2xl font-fraunces text-mm-g mb-6">Catálogo de Productos</h2>
        
        <div className="space-y-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mm-txw" />
              <input 
                type="text" 
                placeholder="¿Qué estás buscando en esta tienda?" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-mm-crd rounded-full py-2.5 pl-11 pr-4 text-sm outline-none focus:border-mm-g transition-all"
              />
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(c => (
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

        {loadingProducts ? (
          <div className="py-12 text-center text-mm-txs">Cargando productos...</div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredProducts.map(product => (
              <motion.div
                key={product.id}
                whileHover={{ y: -5 }}
                className="bg-white rounded-[28px] border border-mm-crd shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col group border-b-4 border-b-mm-crd hover:border-b-mm-g duration-200"
              >
                <div className="h-40 bg-mm-gbg flex items-center justify-center text-5xl relative overflow-hidden">
                  {product.imageSignedUrl ? (
                    <img src={product.imageSignedUrl} alt={product.catalog_products?.name || 'Producto'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <span className="group-hover:scale-125 transition-transform duration-500">📦</span>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <h3 className="font-bold text-mm-g mb-0.5 line-clamp-1 group-hover:text-mm-oro transition-colors text-sm sm:text-base">{product.catalog_products?.name}</h3>
                    <p className="text-[10px] text-mm-txw mb-3 font-medium uppercase tracking-widest">{product.catalog_products?.categories?.name}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-1 border-t border-mm-crd/50 gap-2">
                    <div className="flex flex-col">
                      <p className="font-bold text-mm-g text-lg sm:text-xl tracking-tight leading-none">
                        {fmt(product.price_per_unit || 0)}
                      </p>
                      <p className="text-[9px] text-mm-txs font-bold uppercase tracking-wider mt-0.5">
                        / {product.measurement_units?.abbreviation}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleAddToCart(e, product)}
                      className="w-10 h-10 sm:w-12 sm:h-12 bg-mm-g text-white rounded-2xl flex items-center justify-center hover:bg-mm-oro hover:-translate-y-1 hover:shadow-lg transition-all active:scale-95 shrink-0"
                    >
                      <ShoppingCart className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 bg-mm-gbg/30 rounded-3xl border border-mm-crd text-center text-mm-txw">
            No se encontraron productos con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  );
}
