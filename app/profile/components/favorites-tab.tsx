'use client';

import { motion } from 'motion/react';
import { useApp } from '@/src/store';
import { Store, Heart } from 'lucide-react';

export function FavoritesTab() {
  const { state, dispatch } = useApp();
  const profile = state.buyerProfile;

  return (
    <motion.div
      key="favorites"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <h2 className="text-3xl font-fraunces text-mm-g">Tiendas Favoritas</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        {profile.favoriteStores.map((storeId) => {
          const store = state.stores.find((s) => s.id === storeId);
          if (!store) return null;
          return (
            <div
              key={storeId}
              className="bg-white p-5 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-4 group cursor-pointer hover:border-mm-g transition-all"
              onClick={() =>
                dispatch({ type: 'SELECT_STORE', plazaId: store.plazaId, storeId: store.id })
              }
            >
              <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform overflow-hidden border border-mm-crd shadow-inner">
                {store.image ? (
                  <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-mm-txw" />
                )}
              </div>
              <div className="flex-grow">
                <h4 className="font-bold text-mm-g">{store.name}</h4>
                <p className="text-xs text-mm-txw">{store.cat}</p>
              </div>
              <button
                className="p-2 text-r hover:bg-rl rounded-full transition-all relative z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = profile.favoriteStores.filter((id) => id !== storeId);
                  dispatch({ type: 'UPDATE_BUYER_PROFILE', profile: { favoriteStores: updated } });
                }}
              >
                <Heart className="w-5 h-5 fill-r" />
              </button>
            </div>
          );
        })}

        {profile.favoriteStores.length === 0 && (
          <div className="sm:col-span-2 text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
            <p className="text-mm-txw">Aún no tienes tiendas favoritas.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
