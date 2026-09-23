'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingCart } from 'lucide-react';
import { StoreOffer } from '@/src/features/offers/types/offer.types';
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

  // El mismo bloqueo que hace el Modal genérico (components/ui/modal). Sin él,
  // el fondo se desplaza bajo el overlay al arrastrar en móvil.
  useEffect(() => {
    if (!offer) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [offer]);

  if (!offer) return null;

  const product = offer.store_products?.catalog_products;
  const storeName = offer.store_products?.stores?.name || 'Tienda';

  const originalPrice = offer.store_products?.price_per_unit || 0;
  const discountedPrice = offer.special_price != null
    ? Number(offer.special_price)
    : Math.round(originalPrice * (1 - (offer.discount_pct || 0) / 100));

  const isPercentage = !!offer.discount_pct;
  const discountLabel = isPercentage ? `${offer.discount_pct}% DESCUENTO` : `-$${offer.special_price?.toLocaleString('es-CO')} DTO`;

  const handleAddToCart = () => {
    addToCart({
      id: offer.store_products?.id || '',
      name: product?.name || 'Producto en Oferta',
      cat: 'Ofertas',
      retailPrice: discountedPrice,
      wsPrice: discountedPrice,
      stock: offer.store_products?.stock ?? 0,
      unit: offer.store_products?.measurement_units?.abbreviation || 'und',
      emoji: '🎁',
      image: offer.imageSignedUrl || null,
      plazaId: 1,
      storeId: offer.store_products?.store_id || '',
      storeName,
    } as any, 1, offer.id);
    onClose();
  };

  const content = (
    <AnimatePresence>
      {offer && (
        <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-[200]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-mm-g/60 backdrop-blur-md"
          />
          {/* El panel se topa en 90dvh y el cuerpo scrollea aparte. Antes medía
              ~740px, sin tope ni scroll, dentro de un viewport visible de ~600px:
              se cortaba por arriba y por abajo y el botón "Agregar al carrito"
              quedaba fuera de pantalla sin forma de alcanzarlo. `dvh` y no `vh`
              porque en Safari móvil `vh` es el viewport grande. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-lg max-h-[90dvh] rounded-[40px] shadow-2xl relative z-[210] overflow-hidden flex flex-col"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2.5 rounded-full bg-mm-gbg hover:bg-mm-crd transition-colors z-10"
            >
              <X className="w-5 h-5 text-mm-txs" />
            </button>

            <div className="h-36 sm:h-48 shrink-0 bg-mm-gbg flex items-center justify-center text-6xl sm:text-7xl relative">
              {offer.imageSignedUrl ? (
                <img src={offer.imageSignedUrl} alt={product?.name || ''} className="w-full h-full object-cover" />
              ) : (
                <span>🎁</span>
              )}
              {/* `right-20` le deja sitio al botón de cerrar: con una cifra de
                  siete dígitos la etiqueta llegaba hasta él. */}
              <div className="absolute top-6 left-6 right-20">
                <Badge variant="oro" className="inline-block max-w-full truncate whitespace-nowrap px-3 py-1 text-sm shadow-xl">
                  {discountLabel}
                </Badge>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              <div className="p-5 sm:p-8">
                <div className="mb-6">
                  <p className="text-xs font-bold text-mm-txw uppercase tracking-widest mb-1">{storeName}</p>
                  <h3 className="text-2xl font-fraunces text-mm-g mb-2 break-words">{product?.name}</h3>
                  <p className="text-mm-txs">{offer.label || 'Oferta especial por tiempo limitado'}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <p className="text-xs font-bold text-mm-txw uppercase tracking-widest">Detalle del Producto:</p>
                  <div className="space-y-3">
                    {/* El grupo de la izquierda no se encogía y empujaba la columna
                        de precios fuera del panel, donde quedaba recortada: el
                        usuario perdía justo el dato al que vino. */}
                    <div className="flex items-center justify-between gap-3 p-4 bg-mm-gbg rounded-2xl border border-mm-crd/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">🛍️</span>
                        <div className="min-w-0">
                          <p className="font-bold text-mm-g text-sm truncate">{product?.name}</p>
                          <p className="text-xs text-mm-txs">Valor en oferta</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {isPercentage && <p className="text-[10px] text-r font-bold">Descuento: {offer.discount_pct}%</p>}
                        {originalPrice > 0 && (
                          <p className="text-xs text-mm-txw line-through">${originalPrice.toLocaleString('es-CO')}</p>
                        )}
                        <p className="font-bold text-mm-g">
                          ${discountedPrice.toLocaleString('es-CO')}
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
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(content, document.body);
}
