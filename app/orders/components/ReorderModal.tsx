'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, AlertTriangle, CheckCircle2, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { Button } from '@/src/components/Shared';
import { useApp } from '@/src/store';
import { useCart } from '@/src/features/cart/hooks/use-cart';

type ReorderStatus = 'available' | 'partial' | 'out_of_stock' | 'unavailable';

interface ReorderLine {
  storeProductId: string | null;
  name: string;
  unit: string | null;
  requestedQty: number;
  availableQty: number;
  status: ReorderStatus;
  price: number | null;
  image: string | null;
  storeId: string | null;
  storeName: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

export function ReorderModal({
  isOpen,
  onClose,
  orderId,
}: {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}) {
  const { state } = useApp();
  const { cart, addToCart, clearCart } = useCart();

  const [lines, setLines] = useState<ReorderLine[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/orders/${orderId}/reorder-preview`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error);
        setLines(json.data.lines || []);
        setStoreId(json.data.storeId);
        setStoreName(json.data.storeName);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo preparar la recompra.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, orderId]);

  const addable = lines.filter((l) => l.status === 'available' || l.status === 'partial');
  const blocked = lines.filter((l) => l.status === 'out_of_stock' || l.status === 'unavailable');

  // El carrito admite una sola tienda a la vez, así que si ya tiene productos de
  // otra hay que avisar antes en vez de dejar que falle ítem por ítem.
  const currentCartStoreId = cart.length > 0 ? String(cart[0].storeId) : null;
  const conflict = currentCartStoreId !== null && storeId !== null && currentCartStoreId !== String(storeId);

  const total = addable.reduce((sum, l) => sum + (l.price ?? 0) * l.availableQty, 0);

  const handleAdd = async (replaceCart: boolean) => {
    setAdding(true);
    setError(null);
    try {
      if (replaceCart) await clearCart();

      for (const line of addable) {
        await addToCart(
          {
            id: line.storeProductId!,
            name: line.name,
            cat: '',
            retailPrice: line.price ?? 0,
            wsPrice: line.price ?? 0,
            stock: line.availableQty,
            unit: line.unit || 'und',
            emoji: '📦',
            image: line.image || null,
            plazaId: 1,
            storeId: line.storeId!,
            storeName: line.storeName || 'Tienda',
          } as any,
          line.availableQty
        );
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudieron agregar los productos.');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  const renderLine = (line: ReorderLine, idx: number) => (
    <div key={idx} className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-mm-crd/50 bg-mm-gbg">
        {line.image ? (
          <img src={line.image} alt={line.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-4 w-4 text-mm-txw" />
        )}
      </div>

      <div className="min-w-0 flex-grow">
        <p className="truncate text-sm font-medium text-mm-g">{line.name}</p>
        <p className="text-xs text-mm-txw">
          {line.status === 'unavailable' && 'Ya no se vende en esta tienda'}
          {line.status === 'out_of_stock' && 'Sin existencias'}
          {line.status === 'partial' &&
            `Solo quedan ${line.availableQty} ${line.unit || ''} de los ${line.requestedQty} que pediste`}
          {line.status === 'available' &&
            `${line.availableQty} ${line.unit || ''} · ${line.price !== null ? fmt(line.price) : ''}`}
        </p>
      </div>

      {(line.status === 'available' || line.status === 'partial') && line.price !== null && (
        <span className="shrink-0 text-sm font-bold text-mm-g">
          {fmt(line.price * line.availableQty)}
        </span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-mm-crd p-6">
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-mm-g" />
            <h3 className="font-fraunces text-xl text-mm-g">Recomprar este pedido</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-mm-gbg">
            <X className="h-5 w-5 text-mm-txs" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>
          ) : (
            <div className="space-y-6">
              {conflict && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="mb-1 flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4" /> Tu carrito es de otra tienda
                  </div>
                  Solo puedes comprar en una tienda a la vez. Si continúas, se vaciará tu carrito
                  actual y quedarán solo los productos de {storeName || 'esta tienda'}.
                </div>
              )}

              {addable.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-mm-txw">
                    <CheckCircle2 className="h-3.5 w-3.5 text-ok" /> Se agregarán al carrito
                  </p>
                  <div className="divide-y divide-mm-crd">{addable.map(renderLine)}</div>
                </div>
              )}

              {blocked.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-mm-txw">
                    <AlertTriangle className="h-3.5 w-3.5 text-r" /> No disponibles ahora
                  </p>
                  <div className="divide-y divide-mm-crd opacity-60">{blocked.map(renderLine)}</div>
                </div>
              )}

              {addable.length === 0 && (
                <p className="py-6 text-center text-sm text-mm-txs">
                  Ninguno de los productos de este pedido está disponible en este momento.
                </p>
              )}
            </div>
          )}
        </div>

        {!loading && !error && (
          <div className="border-t border-mm-crd bg-mm-gbg/30 p-6">
            {addable.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-mm-txw">
                  Subtotal
                </span>
                <span className="font-fraunces text-2xl text-mm-g">{fmt(total)}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={adding}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={adding}
                disabled={addable.length === 0 || !state.isLoggedIn}
                onClick={() => handleAdd(conflict)}
              >
                {blocked.length > 0 ? 'Continuar sin esos productos' : 'Agregar al carrito'}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
