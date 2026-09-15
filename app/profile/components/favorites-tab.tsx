'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useFavorites } from '@/src/features/favorites/hooks/use-favorites';
import type { FavoriteStore } from '@/src/features/favorites/types/favorite.types';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { Store as StoreIcon, Heart, Loader2 } from 'lucide-react';

export function FavoritesTab() {
  const router = useRouter();
  const { favoriteStores, loading, error, fetchFavorites, removeFavorite } = useFavorites();

  // Quitar un favorito es un clic pequeño dentro de una tarjeta que además
  // navega, así que se confirma antes de borrar.
  const [storeToRemove, setStoreToRemove] = useState<FavoriteStore | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    fetchFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmRemove = async () => {
    if (!storeToRemove) return;
    setRemoving(true);
    try {
      await removeFavorite(storeToRemove.storeId);
      setStoreToRemove(null);
    } catch {
      // `removeFavorite` ya dejó el mensaje en `error`; el modal se cierra
      // para que quede a la vista.
      setStoreToRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <motion.div
      key="favorites"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="@container space-y-4 sm:space-y-6"
    >
      <h2 className="text-2xl sm:text-3xl font-fraunces text-mm-g">Tiendas Favoritas</h2>

      {error && (
        <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {/* `grid-cols-1` explícito y no `grid` a secas: sin plantilla, la columna
          implícita crece hasta el ancho mínimo del contenido, y un nombre con
          `truncate` (sin salto de línea) la ensanchaba hasta sacar la tarjeta de
          la pantalla. `grid-cols-1` es `minmax(0, 1fr)` y deja que se encoja.

          Dos columnas según el ancho del CONTENEDOR (`@lg`, 512px) y no de la
          pantalla: entre md y lg el menú lateral ya ocupa 256px, y con
          `sm:grid-cols-2` las tarjetas quedaban de ~208px con el nombre cortado. */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3 sm:gap-4">
        {loading && favoriteStores.length === 0 ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
          </div>
        ) : favoriteStores.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
            <p className="text-mm-txw">Aún no tienes tiendas favoritas.</p>
          </div>
        ) : (
          favoriteStores.map((store) => (
            <div
              key={store.storeId}
              className="min-w-0 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-mm-crd shadow-sm flex items-center gap-3 sm:gap-4 group cursor-pointer hover:border-mm-g transition-all"
              onClick={() => router.push(`/stores/${store.slug}`)}
            >
              {/* shrink-0: sin él, un nombre largo aplastaba el logo contra el borde. */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-mm-gbg rounded-xl sm:rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform overflow-hidden border border-mm-crd shadow-inner">
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
                className="p-2.5 -mr-1 sm:mr-0 text-r hover:bg-rl rounded-full transition-all relative z-10 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setStoreToRemove(store);
                }}
                aria-label={`Quitar ${store.name} de favoritas`}
              >
                <Heart className="w-5 h-5 fill-r" />
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={!!storeToRemove}
        onClose={() => setStoreToRemove(null)}
        onConfirm={handleConfirmRemove}
        isLoading={removing}
        variant="danger"
        title="Quitar de favoritas"
        confirmText="Sí, quitar"
        message={
          <>
            <span className="font-bold text-mm-g">{storeToRemove?.name}</span> dejará de
            aparecer en tus tiendas favoritas. Puedes volver a marcarla cuando quieras.
          </>
        }
      />
    </motion.div>
  );
}
