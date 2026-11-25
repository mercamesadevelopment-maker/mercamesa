'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Stamp } from '@/components/ui/stamp';
import { formatCOP } from '@/lib/utils/format';
import { QuantityStepper } from '@/components/ui/quantity-stepper/QuantityStepper';
import { offerLimitLabel } from '@/lib/offers/offer-limit';
import { getSupabaseImageUrl } from '@/lib/supabase/supabase-image';
import { getProductShareUrl, getProductPath } from '@/features/products/utils/share-link';
import { ShareLinkButton } from '@/features/products/components/ShareLinkButton';
import { useProductCart } from '@/features/products/hooks/use-product-cart';
import type { StoreProduct } from '@/app/products/hooks/usePublicProducts';

interface ProductCardProps {
  product: StoreProduct;
  /** El producto al que apuntaba un link compartido: se resalta un momento y se
   * hace scroll hasta él, para que quien lo abre sepa que llegó al correcto. */
  highlighted?: boolean;
}

export function ProductCard({ product, highlighted }: ProductCardProps) {
  const { price, listPrice, hasDiscount, pct, offerMax, tope, stock, qty, unit, add, setQty } = useProductCart(product);
  const [imgSrc, setImgSrc] = useState(product.imageSignedUrl || null);
  const [triedFallback, setTriedFallback] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const href = getProductPath(product.id);

  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlighted]);

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
    add();
  };

  const productName = product.catalog_products?.name || 'Producto';

  return (
    // Caso de marca, lámina 16: foto sobre fondo hueso, nombre, unidad en mono,
    // tienda, precio grande y el botón sobre una base curva. El movimiento es
    // solo CSS (`mm-rise` al entrar en pantalla, `mm-lift` al pasar el mouse):
    // en un listado de cien tarjetas no hay nada corriendo en bucle.
    <div
      ref={cardRef}
      className={cn(
        'mm-rise mm-lift group flex flex-col overflow-hidden rounded-[28px] bg-white',
        'shadow-[0_10px_30px_-18px_rgba(14,59,47,0.35)] hover:shadow-[0_22px_40px_-20px_rgba(14,59,47,0.45)]',
        highlighted && 'ring-4 ring-arcilla ring-offset-2'
      )}
    >
      <div className="relative m-2 mb-0 aspect-[5/4] overflow-hidden rounded-[22px] bg-hueso">
        <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
          {hasDiscount && <Stamp>-{pct}%</Stamp>}
          {(product as any).is_featured && <Stamp tono="tinta">Destacado</Stamp>}
        </div>
        {product.id && (
          <ShareLinkButton
            url={getProductShareUrl(product.id)}
            title={product.catalog_products?.name}
            label="Compartir este producto"
            wrapperClassName="absolute top-2 right-2 z-10"
            className="w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-sm flex items-center justify-center text-tinta transition-colors"
            iconClassName="w-3.5 h-3.5"
          />
        )}
        {/* La foto y el nombre llevan a la página del producto, donde está el zoom.
            El enlace es hermano del botón de compartir, no lo envuelve: compartir
            no navega. */}
        {imgSrc ? (
          <Link href={href} aria-label={`Ver ${productName}`} className="absolute inset-0">
            <img
              src={imgSrc}
              alt={productName}
              className="mm-lift-img h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              width={320}
              height={256}
              onError={handleImageError}
            />
          </Link>
        ) : (
          <Link href={href} aria-label={`Ver ${productName}`} className="absolute inset-0 flex items-center justify-center text-5xl">
            📦
          </Link>
        )}
      </div>

      <div className="flex flex-grow flex-col items-center px-3 pt-3 pb-2 text-center">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-tinta sm:text-base">
          <Link href={href} className="hover:underline">
            {product.catalog_products?.name}
          </Link>
        </h3>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-mm-txw">{unit}</p>
        {product.stores?.name && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-mm-txs">{product.stores.name}</p>
        )}

        <div className="mt-auto flex items-baseline justify-center gap-1.5 pt-2">
          <p className={cn('text-lg font-extrabold tracking-tight sm:text-xl', hasDiscount ? 'text-arcilla-oscura' : 'text-tinta')}>
            {formatCOP(price)}
          </p>
          {hasDiscount && <p className="font-mono text-[11px] text-mm-txw line-through">{formatCOP(listPrice)}</p>}
        </div>
        {stock > 0 && (
          <p className="font-mono text-[10px] text-mm-txw">
            {stock} {unit} disponibles
          </p>
        )}
        {offerMax != null && stock > 0 && (
          <p className="font-mono text-[10px] font-bold text-arcilla-oscura">{offerLimitLabel(offerMax, unit)}</p>
        )}
      </div>

      {/* La base curva: el borde superior es un arco, como en la lámina 16. Sin
          stock no hay nada que agregar; con el producto en la canasta el botón
          cede el puesto al contador, en lima. */}
      <div
        className={cn(
          'mt-1 flex h-12 items-center justify-center px-2 transition-colors',
          stock <= 0 ? 'bg-hueso' : qty > 0 ? 'bg-lima' : 'bg-lima-clara group-hover:bg-lima'
        )}
        style={{ borderTopLeftRadius: '50% 16px', borderTopRightRadius: '50% 16px' }}
      >
        {stock <= 0 ? (
          <span className="font-mono text-[11px] uppercase tracking-widest text-r">Agotado</span>
        ) : qty > 0 ? (
          <QuantityStepper
            qty={qty}
            max={tope}
            onChange={setQty}
            // Bajar de 1 saca el producto de la canasta.
            min={1}
            onBelowMin={() => setQty(0)}
            className="w-full max-w-40 justify-between bg-transparent"
          />
        ) : (
          <button
            onClick={handleAddToCart}
            aria-label="Agregar a la canasta"
            className="flex h-full w-full items-center justify-center text-tinta active:scale-95 transition-transform"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
