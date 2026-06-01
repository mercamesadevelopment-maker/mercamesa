import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingCart } from 'lucide-react';
import { StoreOffer } from '../../admin/offers/hooks/useOffers';
import { Badge, Button } from '@/src/components/Shared';
import { useApp } from '@/src/store';
import { useCart } from '@/src/features/cart/hooks/use-cart';

interface OfferDetailModalProps {
  offer: StoreOffer | null;
  onClose: () => void;
}

export function OfferDetailModal({ offer, onClose }: OfferDetailModalProps) {
  const { state, dispatch } = useApp();
  const { addToCart } = useCart();

  if (!offer) return null;

  const product = offer.store_products?.catalog_products;
  const store = offer.store_products?.store_id; // we might want to fetch store details, but for now we have ID

  const isPercentage = !!offer.discount_pct;
  const discountLabel = isPercentage ? `${offer.discount_pct}% DESCUENTO` : `-$${offer.special_price?.toLocaleString('es-CO')} DTO`;

  const handleAddToCart = () => {
    // In a real app we need full product details. Here we construct a CartItem from what we have.
    const price = offer.special_price || 0; // fallback if not special price
    
    addToCart({
      id: offer.store_products?.id || '',
      name: product?.name || 'Producto en Oferta',
      cat: 'Ofertas',
      retailPrice: price,
      wsPrice: price,
      stock: 100, // mock
      unit: 'und',
      emoji: '🎁',
      image: offer.imageSignedUrl || null,
      plazaId: 1, // mock
      storeId: 1, // mock
      storeName: 'Tienda'
    } as any);
    onClose();
  };

  return (
    <AnimatePresence>
      {offer && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[200]">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-mm-g/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl relative z-[210] overflow-hidden"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full bg-mm-gbg hover:bg-mm-crd transition-colors z-10"
            >
              <X className="w-5 h-5 text-mm-txs" />
            </button>

            <div className="h-48 bg-mm-gbg flex items-center justify-center text-7xl relative">
              {offer.imageSignedUrl ? (
                <img src={offer.imageSignedUrl} alt={product?.name || ''} className="w-full h-full object-cover" />
              ) : (
                <span>🎁</span>
              )}
              <div className="absolute top-6 left-6">
                <Badge variant="oro" className="px-3 py-1 text-sm shadow-xl">
                  {discountLabel}
                </Badge>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-fraunces text-mm-g mb-2">{product?.name}</h3>
                <p className="text-mm-txs">{offer.label || 'Oferta especial por tiempo limitado'}</p>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-xs font-bold text-mm-txw uppercase tracking-widest">Detalle del Producto:</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-mm-gbg rounded-2xl border border-mm-crd/50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🛍️</span>
                      <div>
                        <p className="font-bold text-mm-g text-sm">{product?.name}</p>
                        <p className="text-xs text-mm-txs">Valor en oferta</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isPercentage && <p className="text-[10px] text-r font-bold">Descuento: {offer.discount_pct}%</p>}
                      <p className="font-bold text-mm-g">
                        ${offer.special_price?.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleAddToCart}
                  className="w-full py-4 text-lg"
                >
                  <ShoppingCart className="w-5 h-5" /> Agregar al carrito
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={onClose}
                  className="w-full text-mm-txs hover:text-mm-g"
                >
                  Volver
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
