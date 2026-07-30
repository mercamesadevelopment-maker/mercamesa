import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, X } from 'lucide-react';
import { Button, cn } from '@/src/components/Shared';

interface RatingModalProps {
  isOpen: boolean;
  storeId: string | null;
  storeName?: string;
  initialStars?: number;
  initialComment?: string;
  onClose: () => void;
  onSave: (data: { stars: number; comment: string }) => void;
}

export function RatingModal({
  isOpen,
  storeId,
  storeName,
  initialStars = 5,
  initialComment = '',
  onClose,
  onSave,
}: RatingModalProps) {
  const [ratingValue, setRatingValue] = useState(initialStars);
  const [ratingComment, setRatingComment] = useState(initialComment);

  useEffect(() => {
    if (isOpen) {
      setRatingValue(initialStars);
      setRatingComment(initialComment);
    }
  }, [isOpen, initialStars, initialComment]);

  const handleSave = () => {
    onSave({ stars: ratingValue, comment: ratingComment });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && storeId && (
        <div className="fixed inset-0 z-[155] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-[40px] shadow-2xl overflow-hidden max-w-lg w-full p-10 text-center"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6 text-mm-txs" />
            </button>

            <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm border border-mm-crd/50">
              🏪
            </div>

            <h2 className="text-3xl font-fraunces text-mm-g mb-2">
              ¿Qué tal tu compra?
            </h2>
            <p className="text-mm-txs mb-8 font-medium">
              Califica a <span className="text-mm-g font-bold">{storeName || 'la tienda'}</span>
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
                      "w-10 h-10 transition-colors",
                      star <= ratingValue ? "fill-mm-oro text-mm-oro" : "text-mm-crd"
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-4 mb-8">
              <textarea
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                placeholder="Cuéntanos más sobre los productos..."
                className="w-full bg-mm-gbg/50 rounded-2xl p-6 text-sm outline-none border-1.5 border-transparent focus:border-mm-gll focus:bg-white transition-all min-h-[120px] resize-none"
              />
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave}>
                Enviar Reseña
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
