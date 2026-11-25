'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { Stamp } from '@/components/ui/stamp';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity-stepper/QuantityStepper';
import { formatCOP } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { offerLimitLabel } from '@/lib/offers/offer-limit';
import type { ProductDetail } from '@/lib/store-products/product-detail';
import { useCartPanel } from '@/features/cart/cart-panel-context';
import { useProductCart } from '@/features/products/hooks/use-product-cart';
import { ShareLinkButton } from '@/features/products/components/ShareLinkButton';
import { getProductShareUrl } from '@/features/products/utils/share-link';
import { ProductGallery } from './ProductGallery';
import { ProductSuggestions } from './ProductSuggestions';

/**
 * La página de un producto: lo que la tarjeta no alcanza a mostrar (la
 * descripción, la foto con zoom, la tienda) y «Comprar ahora».
 */
export function ProductDetailView({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const cartPanel = useCartPanel();
  const { price, listPrice, hasDiscount, pct, offerMax, tope, stock, qty, unit, add, setQty } = useProductCart(product);
  const [agregando, setAgregando] = useState(false);
  const name = product.catalog_products.name || 'Producto';
  const agotado = stock <= 0;

  /** Lo deja en la canasta (si no estaba) y la abre, que es donde se paga. */
  const comprarAhora = async () => {
    if (qty > 0) return cartPanel.open();
    setAgregando(true);
    const entro = await add();
    setAgregando(false);
    if (entro) cartPanel.open();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:px-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-2 font-bold text-tinta transition-transform hover:-translate-x-0.5 motion-reduce:transition-none"
      >
        <ArrowLeft className="h-5 w-5" /> Volver
      </button>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery src={product.imageOriginalUrl} placeholderSrc={product.imageSignedUrl ?? null} alt={name} />

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {product.categoryPath && (
                <p className="font-mono text-[11px] uppercase tracking-widest text-mm-txw">{product.categoryPath}</p>
              )}
              <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight text-tinta sm:text-3xl">{name}</h1>
              <p className="mt-1 font-mono text-xs uppercase tracking-widest text-mm-txw">{unit}</p>
            </div>
            <ShareLinkButton
              url={getProductShareUrl(product.id)}
              title={name}
              label="Compartir este producto"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-mm-crd bg-white text-tinta hover:bg-mm-gbg"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className={cn('text-3xl font-extrabold tracking-tight sm:text-4xl', hasDiscount ? 'text-arcilla-oscura' : 'text-tinta')}>
              {formatCOP(price)}
            </p>
            {hasDiscount && (
              <>
                <p className="font-mono text-sm text-mm-txw line-through">{formatCOP(listPrice)}</p>
                <Stamp>-{pct}%</Stamp>
              </>
            )}
          </div>
          <p className="mt-2 font-mono text-xs text-mm-txw">{agotado ? 'Agotado' : `${stock} ${unit} disponibles`}</p>
          {offerMax != null && !agotado && (
            <p className="font-mono text-xs font-bold text-arcilla-oscura">{offerLimitLabel(offerMax, unit)}</p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="flex-1 whitespace-nowrap px-6" onClick={comprarAhora} disabled={agotado} loading={agregando}>
              Comprar ahora
            </Button>
            {qty > 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl bg-lima px-2">
                <QuantityStepper
                  qty={qty}
                  max={tope}
                  onChange={setQty}
                  min={1}
                  onBelowMin={() => setQty(0)}
                  className="w-full max-w-48 justify-between bg-transparent"
                />
              </div>
            ) : (
              <Button size="lg" variant="outline" className="flex-1 whitespace-nowrap border-2 px-6" onClick={() => add()} disabled={agotado}>
                <ShoppingBag className="h-5 w-5" /> Agregar a la canasta
              </Button>
            )}
          </div>

          {product.store.slug && (
            <Link
              href={`/stores/${product.store.slug}`}
              className="mm-lift mt-6 flex items-center gap-4 rounded-[24px] border border-mm-crd bg-white p-4"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-mm-crd/40 bg-mm-gbg">
                {product.store.logoUrl ? (
                  <img src={product.store.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <StoreIcon className="h-6 w-6 text-mm-txw" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-mm-txw">Lo vende</p>
                <p className="truncate font-semibold text-tinta">{product.store.name}</p>
                {product.store.marketplace && <p className="truncate text-xs text-mm-txs">{product.store.marketplace}</p>}
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-tinta">
                Ver tienda <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}

          {product.description && (
            <section className="mt-8" aria-label="Descripción">
              <h2 className="font-display text-lg font-extrabold text-tinta">Descripción</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-mm-txs">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      <ProductSuggestions
        productId={product.id}
        storeId={product.store.id}
        storeName={product.store.name}
        category={product.catalog_products.categories?.name ?? null}
      />
    </div>
  );
}
