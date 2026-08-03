'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Star, MessageSquare, Smile, Loader2 } from 'lucide-react';
import { useStoreReviews } from '@/src/features/stores/hooks/use-store-reviews';
import { cn } from '@/src/components/Shared';

interface StoreReputationTabProps {
  storeId: string | null;
}

export function StoreReputationTab({ storeId }: StoreReputationTabProps) {
  const { reviews, loading, error, fetchReviews } = useStoreReviews(storeId ?? undefined);

  useEffect(() => {
    if (storeId) fetchReviews();
  }, [storeId, fetchReviews]);

  const { average, breakdown } = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.stars, 0);
    const avg = total > 0 ? sum / total : 0;
    const counts = [5, 4, 3, 2, 1].map((stars) => {
      const count = reviews.filter((r) => r.stars === stars).length;
      const pct = total > 0 ? (count / total) * 100 : 0;
      return { stars, count, pct };
    });
    return { average: avg, breakdown: counts };
  }, [reviews]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  if (error) {
    return <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">{error}</div>;
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-xl text-center space-y-4">
          <div className="w-20 h-20 bg-mm-oro/10 rounded-3xl flex items-center justify-center mx-auto">
            <Star className="w-10 h-10 text-mm-oro fill-mm-oro" />
          </div>
          <div>
            <p className="text-5xl font-fraunces text-mm-g">{average.toFixed(1)}</p>
            <p className="text-xs font-black uppercase text-mm-txw tracking-widest mt-1">Calificación General</p>
          </div>
          <div className="flex justify-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-5 h-5",
                  i < Math.round(average) ? "text-mm-oro fill-mm-oro" : "text-mm-crd fill-mm-crd"
                )}
              />
            ))}
          </div>
          <p className="text-sm text-mm-txs">Basado en {reviews.length} reseñas verificadas.</p>
        </div>

        <div className="bg-mm-gbg/20 p-6 rounded-[32px] border border-mm-crd/50">
          <h4 className="text-sm font-bold text-mm-g mb-4 uppercase tracking-tighter">Resumen de Calificaciones</h4>
          <div className="space-y-3">
            {breakdown.map(({ stars, count, pct }) => (
              <div key={stars} className="flex items-center gap-3">
                <span className="text-xs font-bold text-mm-txs w-2">{stars}</span>
                <div className="flex-grow h-2 bg-mm-gbg rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    className="h-full bg-mm-oro"
                  />
                </div>
                <span className="text-[10px] font-bold text-mm-txw min-w-[20px]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <h3 className="text-xl font-fraunces text-mm-g flex items-center gap-2">
          Reseñas Recientes <MessageSquare className="w-5 h-5" />
        </h3>
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="bg-white p-12 rounded-[40px] border border-mm-crd shadow-sm text-center">
              <Smile className="w-12 h-12 text-mm-txw mx-auto mb-4 opacity-20" />
              <p className="text-mm-txs">Esta tienda aún no tiene calificaciones. ¡Brinda un gran servicio para obtener las primeras!</p>
            </div>
          ) : (
            [...reviews]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((review) => {
                const buyerName = review.profiles?.full_name || 'Comprador';
                return (
                  <div key={review.id} className="bg-white p-8 rounded-[40px] border border-mm-crd shadow-sm space-y-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-mm-gbg flex items-center justify-center text-mm-g font-bold text-xl">
                          {buyerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base font-bold text-mm-g">{buyerName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "w-3.5 h-3.5",
                                    i < review.stars ? "text-mm-oro fill-mm-oro" : "text-mm-crd fill-mm-crd"
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-mm-txw font-bold uppercase">• {new Date(review.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-mm-txs italic text-lg leading-relaxed">
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
