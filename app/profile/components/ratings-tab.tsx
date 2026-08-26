'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/src/store';
import { Button } from '@/src/components/Shared';
import { cn } from '@/src/components/Shared';
import { formatOrderCode } from '@/src/features/orders/utils/orderCode';
import { Star, Clock, CheckCircle2, XCircle } from 'lucide-react';

export function RatingsTab() {
  const { state, dispatch } = useApp();
  const profile = state.buyerProfile;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ratingStoreId, setRatingStoreId] = useState<number | string | null>(null);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  const openRating = (storeId: number | string, orderId: string) => {
    setRatingStoreId(storeId);
    setRatingOrderId(orderId);
    setRatingValue(5);
    setRatingComment('');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!ratingStoreId) return;

    const newRatings = { ...profile.storeRatings };
    newRatings[ratingStoreId] = {
      stars: ratingValue,
      comment: ratingComment,
      date: new Date().toISOString(),
    };

    dispatch({ type: 'UPDATE_BUYER_PROFILE', profile: { storeRatings: newRatings } });

    dispatch({
      type: 'ADD_REVIEW',
      review: {
        id: Math.random().toString(36).substr(2, 9),
        storeId: ratingStoreId,
        buyerId: state.isLoggedIn ? state.buyerProfile.email : 'guest',
        buyerName: state.buyerProfile.name,
        stars: ratingValue,
        comment: ratingComment,
        date: new Date().toISOString(),
      },
    });

    dispatch({
      type: 'ADD_NOTIF',
      notif: {
        id: Math.random().toString(36).substr(2, 9),
        type: 'rating',
        title: '¡Gracias por tu calificación!',
        msg: `Tu opinión sobre ${state.stores.find((s) => String(s.id) === String(ratingStoreId))?.name} ha sido enviada.`,
        time: 'Ahora',
        read: false,
      },
    });

    setIsModalOpen(false);
  };

  const pendingOrders = state.orders.filter(
    (o) => o.status === 'delivered' && !profile.storeRatings[o.storeId]
  );

  return (
    <>
      <motion.div
        key="ratings"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-8"
      >
        <div>
          <h2 className="text-3xl font-fraunces text-mm-g mb-2">Calificaciones</h2>
          <p className="text-mm-txs">Tu opinión ayuda a mejorar la comunidad de MercaMesa.</p>
        </div>

        {/* Pendientes */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-mm-txw uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pendientes
          </h3>
          <div className="grid gap-4">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm flex items-center gap-6"
              >
                <div className="w-16 h-16 bg-mm-gbg rounded-2xl flex items-center justify-center overflow-hidden border border-mm-crd shadow-inner">
                  <img
                    src="https://picsum.photos/seed/store/100/100"
                    alt={order.storeName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-mm-g text-lg">{order.storeName}</h4>
                  <p className="text-xs text-mm-txw">
                    Pedido {formatOrderCode(order.code, order.storeOrderId)} • {new Date(order.date).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" onClick={() => openRating(order.storeId, order.id)}>
                  Calificar
                </Button>
              </div>
            ))}
            {pendingOrders.length === 0 && (
              <div className="p-10 text-center bg-mm-gbg/20 rounded-[32px] border border-dashed border-mm-crd opacity-60">
                <p className="text-mm-txs">¡Estás al día! No tienes calificaciones pendientes.</p>
              </div>
            )}
          </div>
        </div>

        {/* Mis Opiniones */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-mm-txw uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Mis Opiniones
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {Object.entries(profile.storeRatings).map(([storeId, rating]: [string, any]) => {
              const store = state.stores.find((s) => String(s.id) === String(storeId));
              if (!store) return null;
              return (
                <div
                  key={storeId}
                  className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-mm-gbg rounded-xl flex items-center justify-center text-2xl">
                      {store.emoji}
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-bold text-mm-g">{store.name}</h4>
                      <div className="flex text-mm-oro">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'w-3.5 h-3.5',
                              i < rating.stars ? 'fill-mm-oro' : 'text-mm-crd'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-mm-txw font-medium bg-mm-gbg px-2 py-1 rounded-lg">
                      {new Date(rating.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-mm-txs italic">
                    &ldquo;{rating.comment || 'Sin comentarios'}&rdquo;
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Rating Modal */}
      <AnimatePresence>
        {isModalOpen && ratingStoreId && (
          <div className="fixed inset-0 z-[155] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10 text-center"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
              >
                <XCircle className="w-6 h-6 text-mm-txs" />
              </button>

              <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm border border-mm-crd/50">
                {state.stores.find((s) => String(s.id) === String(ratingStoreId))?.emoji}
              </div>

              <h2 className="text-3xl font-fraunces text-mm-g mb-2">¿Qué tal tu experiencia?</h2>
              <p className="text-mm-txs mb-8 font-medium">
                Califica a{' '}
                <span className="text-mm-g font-bold">
                  {state.stores.find((s) => String(s.id) === String(ratingStoreId))?.name}
                </span>
              </p>

              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className="p-1 focus:outline-none transition-transform active:scale-90"
                  >
                    <Star
                      className={cn(
                        'w-10 h-10 transition-colors',
                        star <= ratingValue ? 'fill-mm-oro text-mm-oro' : 'text-mm-crd'
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-4 mb-8">
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Cuéntanos más... ¿Los productos estaban frescos? ¿Llegaron a tiempo?"
                  className="w-full bg-mm-gbg/50 rounded-2xl p-6 text-sm outline-none border-1.5 border-transparent focus:border-mm-gll focus:bg-white transition-all min-h-[120px] resize-none"
                />
                <div className="flex flex-wrap justify-center gap-2">
                  {['Productos frescos', 'Gran servicio', 'Precio justo', 'Rápido'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() =>
                        setRatingComment((prev) => (prev ? `${prev}, ${chip}` : chip))
                      }
                      className="px-4 py-1.5 bg-mm-gbg text-mm-txs text-xs font-bold rounded-full hover:bg-mm-gll transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                  Omitir
                </Button>
                <Button className="flex-1" onClick={handleSave}>
                  Enviar Opinión
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
