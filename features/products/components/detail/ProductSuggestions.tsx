'use client';

import React, { useEffect, useState } from 'react';
import { ProductCard } from '@/features/products/components/ProductCard';
import type { StoreProduct } from '@/app/products/hooks/usePublicProducts';

/** Cuántos se muestran por fila. */
const POR_FILA = 8;

async function pedir(params: Record<string, string>): Promise<StoreProduct[]> {
  const q = new URLSearchParams({ page: '1', pageSize: String(POR_FILA + 1), ...params });
  try {
    const res = await fetch(`/api/store-products?${q}`);
    if (!res.ok) return [];
    return ((await res.json()).data ?? []) as StoreProduct[];
  } catch {
    return [];
  }
}

/**
 * Los sugeridos de la página del producto, del mismo endpoint de la vitrina
 * (`GET /api/store-products`): ya respeta lo publicado y lo exclusivo.
 *
 * - «Más de <tienda>»: la misma subcategoría en esa tienda; si son pocos, se
 *   completa con el resto de la tienda.
 * - «Parecidos en otras tiendas»: la misma subcategoría, en las demás.
 */
export function ProductSuggestions({
  productId,
  storeId,
  storeName,
  category,
}: {
  productId: string;
  storeId: string;
  storeName: string;
  /** La subcategoría del producto (`category_name` de la vitrina). */
  category: string | null;
}) {
  const [deLaTienda, setDeLaTienda] = useState<StoreProduct[] | null>(null);
  const [deOtras, setDeOtras] = useState<StoreProduct[] | null>(null);

  useEffect(() => {
    let vigente = true;
    const sinEste = (lista: StoreProduct[]) => lista.filter((p) => p.id !== productId);

    (async () => {
      const mismaCategoria = category ? sinEste(await pedir({ store_id: storeId, subcategory: category })) : [];
      let tienda = mismaCategoria;
      if (tienda.length < 4) {
        const resto = sinEste(await pedir({ store_id: storeId }));
        const ya = new Set(tienda.map((p) => p.id));
        tienda = [...tienda, ...resto.filter((p) => !ya.has(p.id))];
      }
      if (vigente) setDeLaTienda(tienda.slice(0, POR_FILA));
    })();

    (async () => {
      // Se piden de más porque se quitan los de esta tienda.
      const otras = category ? await pedir({ subcategory: category, pageSize: String(POR_FILA * 3) }) : [];
      if (vigente) setDeOtras(otras.filter((p) => p.store_id !== storeId).slice(0, POR_FILA));
    })();

    return () => {
      vigente = false;
    };
  }, [productId, storeId, category]);

  return (
    <>
      <Fila titulo={`Más de ${storeName}`} productos={deLaTienda} />
      <Fila titulo="Parecidos en otras tiendas" productos={deOtras} />
    </>
  );
}

/** Una fila que se desliza de lado. Mientras carga reserva su alto; sin productos no aparece. */
function Fila({ titulo, productos }: { titulo: string; productos: StoreProduct[] | null }) {
  if (productos && productos.length === 0) return null;
  return (
    <section className="mt-12" aria-label={titulo}>
      <h2 className="mb-4 font-display text-xl font-extrabold text-tinta sm:text-2xl">{titulo}</h2>
      {productos ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:gap-4">
          {productos.map((p) => (
            <div key={p.id} className="w-40 shrink-0 snap-start sm:w-52">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-72 animate-pulse rounded-[28px] bg-mm-gbg motion-reduce:animate-none" aria-hidden />
      )}
    </section>
  );
}
