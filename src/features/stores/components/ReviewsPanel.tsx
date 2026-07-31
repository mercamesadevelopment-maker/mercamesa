import React from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { cn } from '@/src/components/Shared';
import type { StoreReview } from '../types/review.types';

interface ReviewsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reviews: StoreReview[];
}

export function ReviewsPanel({ isOpen, onClose, reviews }: ReviewsPanelProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reseñas de la tienda" maxWidth="max-w-2xl">
      <div className="p-6">
        {reviews.length === 0 ? (
          <div className="py-12 bg-mm-gbg/30 rounded-3xl border border-mm-crd text-center text-mm-txw flex flex-col items-center gap-3">
            <MessageSquare className="w-10 h-10 text-mm-txw" />
            Todavía no hay reseñas para esta tienda.
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-mm-g">{review.profiles?.full_name || 'Comprador'}</p>
                  <div className="flex items-center gap-1 text-mm-oro">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn('w-4 h-4', i < review.stars ? 'fill-mm-oro' : 'text-mm-crd')} />
                    ))}
                  </div>
                </div>
                {review.comment && <p className="text-sm text-mm-txs">{review.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
