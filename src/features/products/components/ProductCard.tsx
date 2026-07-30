'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart } from 'lucide-react';
import { Badge, cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { useCart } from '@/src/features/cart/hooks/use-cart';
import { getSupabaseImageUrl } from '@/lib/supabase/supabase-image';
import type { StoreProduct } from '@/app/sections/products/hooks/usePublicProducts';

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addToCart } = useCart();
  const [imgSrc, setImgSrc] = useState(product.imageSignedUrl || null);
  const [triedFallback, setTriedFallback] = useState(false);

  // Red de seguridad: si el derivado WebP aún no existe (imagen subida antes
  // del backfill, o formato que sharp no pudo procesar), cae al original.
  const handleImageError = () => {
    if (triedFallback) {
      setImgSrc(null);
      return;
    }
    setTriedFallback(true);
    const original = product.catalog_products?.image_url;
    setImgSrc(original ? getSupabaseImageUrl('products', original) : null);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.catalog_products?.name || 'Producto',
      cat: product.catalog_products?.categories?.name || 'Sin Categoría',
      retailPrice: product.price_per_unit || 0,
      wsPrice: product.price_per_unit || 0,
      stock: product.stock ?? 0,
      unit: product.measurement_units?.abbreviation || 'und',
      emoji: '📦',
      image: product.imageSignedUrl || null,
      plazaId: 1,
      storeId: product.store_id,
      storeName: product.stores?.name || 'Tienda',
    } as any);
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white rounded-[28px] border border-mm-crd shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col group border-b-4 border-b-mm-crd hover:border-b-mm-g duration-200"
    >
      <div className="h-40 bg-mm-gbg flex items-center justify-center text-5xl relative overflow-hidden">
        {(product as any).is_featured && (
          <Badge variant="oro" className="absolute top-2 left-2 z-10">
            Destacado
          </Badge>
        )}
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.catalog_products?.name || 'Producto'}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <span className="group-hover:scale-125 transition-transform duration-500">📦</span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex-grow">
          {product.stores?.name && (
            <p className="text-[10px] text-mm-txw font-bold uppercase tracking-tighter mb-1 line-clamp-1">
              {product.stores.name}
            </p>
          )}
          <h3 className="font-bold text-mm-g mb-0.5 line-clamp-1 group-hover:text-mm-oro transition-colors text-sm sm:text-base">
            {product.catalog_products?.name}
          </h3>
          <p className="text-[10px] text-mm-txw mb-1 font-medium uppercase tracking-widest">
            {product.catalog_products?.categories?.name}
          </p>
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest mb-3',
              product.stock > 0 ? 'text-mm-g/70' : 'text-r'
            )}
          >
            {product.stock > 0 ? `Stock: ${product.stock} ${product.measurement_units?.abbreviation || 'und'}` : 'Sin stock'}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-mm-crd/50 gap-2">
          <div className="flex flex-col">
            <p className="font-bold text-mm-g text-lg sm:text-xl tracking-tight leading-none">
              {fmt(product.price_per_unit || 0)}
            </p>
            <p className="text-[9px] text-mm-txs font-bold uppercase tracking-wider mt-0.5">
              / {product.measurement_units?.abbreviation}
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-mm-g text-white rounded-2xl flex items-center justify-center hover:bg-mm-oro hover:-translate-y-1 hover:shadow-lg transition-all active:scale-95 shrink-0"
          >
            <ShoppingCart className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
