'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useFavorites } from '@/src/features/favorites/hooks/use-favorites';
import { Store as StoreIcon, Heart, Loader2 } from 'lucide-react';

export function FavoritesTab() {
  const router = useRouter();
  const { favoriteStores, loading, error, fetchFavorites, removeFavorite } = useFavorites();

  useEffect(() => {
    fetchFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      key="favorites"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <h2 className="text-3xl font-fraunces text-mm-g">Tiendas Favoritas</h2>

      {error && (
        <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {loading && favoriteStores.length === 0 ? (
          <div className="sm:col-span-2 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
          </div>
        ) : favoriteStores.length === 0 ? (
          <div className="sm:col-span-2 text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
            <p className="text-mm-txw">Aún no tienes tiendas favoritas.</p>
          </div>
        ) : (
          favoriteStores.map((store) => (
            <div
              key={store.storeId}
              className="bg-white p-5 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-4 group cursor-pointer hover:border-mm-g transition-all"
              onClick={() => router.push(`/stores/${store.slug}`)}
            >
              <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform overflow-hidden border border-mm-crd shadow-inner">
                {store.logoUrl ? (
                  <img src={store.logoUrl} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <StoreIcon className="w-6 h-6 text-mm-txw" />
                )}
              </div>
              <div className="flex-grow min-w-0">
                <h4 className="font-bold text-mm-g truncate">{store.name}</h4>
                <p className="text-xs text-mm-txw truncate">{store.marketplaceName}</p>
              </div>
              <button
                className="p-2 text-r hover:bg-rl rounded-full transition-all relative z-10 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFavorite(store.storeId);
                }}
              >
                <Heart className="w-5 h-5 fill-r" />
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
