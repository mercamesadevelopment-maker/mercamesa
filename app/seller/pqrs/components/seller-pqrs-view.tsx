'use client';

import React from 'react';
import { useSellerStore } from '@/app/hooks/use-seller-store';
import { PqrsView } from '@/src/features/pqrs/components/PqrsView';

/** Las PQRS de la tienda activa del tendero. */
export function SellerPqrsView() {
  const { stores, storeId, selectStore, error } = useSellerStore();

  if (error) return <div className="p-12 text-center text-r">{error}</div>;

  return (
    <PqrsView
      scope="seller"
      title="PQRS"
      subtitle="Los reclamos de tus compradores y las solicitudes que le haces a MercaMesa."
      storeId={storeId}
      headerExtra={
        stores.length > 1 && (
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-mm-txw">Tienda Activa</label>
            <select
              value={storeId || ''}
              onChange={(e) => selectStore(e.target.value)}
              className="bg-white text-mm-g font-semibold text-sm border border-mm-crd rounded-xl px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-mm-g/20 cursor-pointer"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )
      }
    />
  );
}
