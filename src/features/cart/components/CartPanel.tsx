'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, ShoppingBag, X, AlertTriangle, Info, Store as StoreIcon } from 'lucide-react';
import { useCheckout } from '../hooks/useCheckout';
import { useCart } from '../hooks/use-cart';
import { Button, Badge } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { CartItem } from '@/src/types';

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartPanel({ isOpen, onClose }: CartPanelProps) {
  const { updateCartQty, updateCartItemNotes } = useCart();
  const {
    state,
    isPlacingOrder,
    errorMessage,
    cartByStore,
    subtotal,
    totalDeliveryFee,
    total,
    getPrice,
    handlePlaceOrder,
  } = useCheckout();

  const [deletingItem, setDeletingItem] = React.useState<CartItem | null>(null);

  const handleDecrement = (item: CartItem) => {
    if (item.qty === 1) {
      setDeletingItem(item);
    } else {
      updateCartQty(item.id, item.qty - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cart-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-mm-g/40 backdrop-blur-sm z-[200]"
        />
      )}
      {isOpen && (
        <motion.div
          key="cart-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[210] flex flex-col"
        >
          {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-mm-gbg">
              <h2 className="text-2xl font-fraunces text-mm-g flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" /> Tu Canasta
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-mm-gbg rounded-full transition-colors text-mm-txs"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Body */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {cartByStore.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-mm-txw opacity-60">
                  <ShoppingBag className="w-16 h-16 mb-4" />
                  <p className="font-medium text-lg">Tu canasta está vacía</p>
                </div>
              ) : (
                <>
                  {/* Multi-Store Notice Banner */}
                  {cartByStore.length > 1 && (
                    <div className="p-3.5 bg-mm-gbg/60 border border-mm-crd/40 rounded-2xl flex items-start gap-2.5 text-xs text-mm-g font-medium leading-relaxed">
                      <Info className="w-4 h-4 text-mm-g shrink-0 mt-0.5" />
                      <div>
                        Canasta multi-tienda: tienes productos de <strong>{cartByStore.length} tiendas</strong>. Se procesará un pedido independiente por cada tienda.
                      </div>
                    </div>
                  )}

                  {/* Grouped by Store */}
                  {cartByStore.map((group, groupIdx) => (
                    <div key={group.store.id || groupIdx} className="bg-white border border-mm-crd/40 rounded-2xl p-4 space-y-4 shadow-sm">
                      {/* Store Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-mm-gbg">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{group.store.emoji || '🏪'}</span>
                          <div>
                            <h3 className="font-bold text-mm-g text-base leading-tight">
                              {group.store.name}
                            </h3>
                            <span className="text-[10px] text-mm-txw uppercase tracking-wider font-bold">
                              Pedido Independiente
                            </span>
                          </div>
                        </div>
                        <Badge variant="oro" className="text-[10px]">
                          Envío $ 5.000
                        </Badge>
                      </div>

                      {/* Store Products */}
                      {group.items.map((item, itemIdx) => (
                        <div key={item.id || itemIdx} className="flex flex-col border-b border-mm-gbg/50 pb-3 last:border-0 last:pb-0">
                          <div className="flex gap-4 items-center">
                            <div className="w-16 h-16 bg-mm-gbg rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden border border-mm-crd/30 relative">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                item.emoji
                              )}
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <p className="font-bold text-mm-g text-sm leading-tight truncate">
                                  {item.name}
                                </p>
                              </div>

                              {/* Unidad de medida */}
                              <p className="text-[11px] text-mm-txw font-medium mt-0.5">
                                Unidad: <span className="font-bold text-mm-txs">{item.unit || 'und'}</span>
                              </p>

                              {/* Alerta de oferta expirada */}
                              {item.offerExpired && (
                                <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg mt-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
                                  <span>La oferta venció. Se aplicó el precio regular.</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-baseline gap-1">
                                  <p className="font-bold text-mm-g text-sm">
                                    {fmt(getPrice(item))}
                                  </p>
                                  <span className="text-[10px] text-mm-txw">
                                    / {item.unit || 'und'}
                                  </span>
                                </div>

                                {/* Control de cantidad */}
                                <div className="flex items-center gap-2 bg-mm-gbg rounded-full px-2 py-1">
                                  <button
                                    onClick={() => handleDecrement(item)}
                                    className="w-5 h-5 flex items-center justify-center font-bold text-mm-txs hover:text-mm-g hover:bg-white rounded-full transition-colors text-xs"
                                  >
                                    -
                                  </button>
                                  <span className="text-xs font-bold w-4 text-center">
                                    {item.qty}
                                  </span>
                                  <button
                                    onClick={() =>
                                      updateCartQty(item.id, item.qty + 1)
                                    }
                                    className="w-5 h-5 flex items-center justify-center font-bold text-mm-txs hover:text-mm-g hover:bg-white rounded-full transition-colors text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Especificaciones / Indicaciones Especiales por Producto */}
                          <div className="mt-2.5 flex flex-col gap-1 pl-2 border-l-2 border-mm-crd/40">
                            <label className="text-[10px] text-mm-txw uppercase tracking-wider font-bold">
                              Indicación especial (ej: más verde, más maduro...)
                            </label>
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                              placeholder="Ej: tomates medianamente verdes..."
                              className="w-full px-3 py-1.5 rounded-xl border border-mm-crd/40 bg-mm-gbg/15 text-xs text-mm-g focus:border-mm-g outline-none transition-all placeholder:text-mm-txw/60"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer Summary */}
            {cartByStore.length > 0 && (
              <div className="p-6 bg-mm-gbg/50 border-t border-mm-crd/30">
                {errorMessage && (
                  <div className="mb-4 p-3 bg-rl rounded-xl text-r text-sm font-medium">
                    {errorMessage}
                  </div>
                )}
                <div className="space-y-2.5 mb-6">
                  <div className="flex justify-between text-mm-txs text-sm">
                    <span>Subtotal productos</span>
                    <span className="font-bold">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-mm-txs text-sm">
                    <span>Costo envío ({cartByStore.length} tienda{cartByStore.length > 1 ? 's' : ''})</span>
                    <span className="font-bold">{fmt(totalDeliveryFee)}</span>
                  </div>
                  <div className="pt-3 border-t border-mm-crd/50 flex justify-between items-center">
                    <span className="font-bold text-mm-g">Total a pagar</span>
                    <span className="text-2xl font-bold text-mm-g">
                      {fmt(total)}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => handlePlaceOrder(onClose)}
                  loading={isPlacingOrder}
                  className="w-full py-4 text-lg"
                >
                  Confirmar Pedido
                </Button>
              </div>
            )}
          </motion.div>
      )}

      {/* ConfirmModal para eliminar producto de canasta */}
      <ConfirmModal
        isOpen={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => {
          if (deletingItem) {
            updateCartQty(deletingItem.id, 0);
            setDeletingItem(null);
          }
        }}
        title="¿Retirar producto de tu canasta?"
        message={`¿Estás seguro de que deseas retirar "${deletingItem?.name}" de tu canasta?`}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </AnimatePresence>
  );
}
