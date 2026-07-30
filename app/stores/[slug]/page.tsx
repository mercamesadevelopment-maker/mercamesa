'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, Store as StoreIcon, Star, Phone, MapPin, Heart } from 'lucide-react';
import { Badge, cn } from '@/src/components/Shared';
import { usePublicProducts } from '@/app/sections/products/hooks/usePublicProducts';
import { useApp } from '@/src/store';
import { useFavorites } from '@/src/features/favorites/hooks/use-favorites';
import { ProductCard } from '@/src/features/products/components/ProductCard';

export default function StoreDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { state } = useApp();
  const { isFavorite, toggleFavorite, fetchFavoriteIds } = useFavorites();

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

  useEffect(() => {
    if (state.isLoggedIn) fetchFavoriteIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isLoggedIn]);

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
        {state.isLoggedIn && (
          <button
            onClick={() => toggleFavorite(store.id)}
            className="absolute top-6 right-6 z-10 p-2.5 rounded-full bg-white hover:bg-mm-gbg border border-mm-crd shadow-sm transition-all"
          >
            <Heart
              className={cn(
                'w-5 h-5 transition-colors',
                isFavorite(store.id) ? 'fill-r text-r' : 'text-mm-txw'
              )}
            />
          </button>
        )}

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
              <ProductCard key={product.id} product={product} />
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
