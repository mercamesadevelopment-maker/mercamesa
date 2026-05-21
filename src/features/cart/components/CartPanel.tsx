'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, ShoppingBag, X, Trash2 } from 'lucide-react';
import { useCheckout } from '../hooks/useCheckout';
import { Button } from '@/src/components/Shared';
import { fmt } from '@/src/constants';

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartPanel({ isOpen, onClose }: CartPanelProps) {
  const {
    state,
    dispatch,
    isPlacingOrder,
    errorMessage,
    cartByStore,
    subtotal,
    totalDeliveryFee,
    total,
    getPrice,
    handlePlaceOrder,
  } = useCheckout();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-mm-g/40 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[210] flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b border-mm-gbg">
              <h2 className="text-2xl font-fraunces text-mm-g flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" /> Tu Canasta
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-mm-gbg rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-mm-txs" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {cartByStore.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-mm-txw opacity-60">
                  <ShoppingBag className="w-16 h-16 mb-4" />
                  <p className="font-medium text-lg">Tu canasta está vacía</p>
                </div>
              ) : (
                cartByStore.map((group) => (
                  <div key={group.store.id} className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-mm-gbg">
                      <span className="text-xl">{group.store.emoji}</span>
                      <h3 className="font-bold text-mm-g">
                        {group.store.name}
                      </h3>
                    </div>
                    {group.items.map((item) => (
                      <div key={item.id} className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-mm-gbg rounded-xl flex items-center justify-center text-2xl shrink-0 overflow-hidden border border-mm-crd/30">
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
                        <div className="flex-grow">
                          <p className="font-bold text-mm-g text-sm leading-tight mb-1">
                            {item.name}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-mm-g">
                              {fmt(getPrice(item))}
                            </p>
                            <div className="flex items-center gap-3 bg-mm-gbg rounded-full px-2 py-1">
                              <button
                                onClick={() =>
                                  dispatch({
                                    type: 'UPDATE_CART_QTY',
                                    productId: item.id,
                                    qty: Math.max(0, item.qty - 1),
                                  })
                                }
                                className="w-6 h-6 flex items-center justify-center font-bold text-mm-txs hover:text-mm-g hover:bg-white rounded-full transition-colors"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold w-4 text-center">
                                {item.qty}
                              </span>
                              <button
                                onClick={() =>
                                  dispatch({
                                    type: 'UPDATE_CART_QTY',
                                    productId: item.id,
                                    qty: item.qty + 1,
                                  })
                                }
                                className="w-6 h-6 flex items-center justify-center font-bold text-mm-txs hover:text-mm-g hover:bg-white rounded-full transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {cartByStore.length > 0 && (
              <div className="p-6 bg-mm-gbg/50 border-t border-mm-crd/30">
                {errorMessage && (
                  <div className="mb-4 p-3 bg-rl rounded-xl text-r text-sm font-medium">
                    {errorMessage}
                  </div>
                )}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-mm-txs text-sm">
                    <span>Subtotal</span>
                    <span className="font-bold">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-mm-txs text-sm">
                    <span>Costo de envío estimado</span>
                    <span className="font-bold">{fmt(totalDeliveryFee)}</span>
                  </div>
                  <div className="pt-3 border-t border-mm-crd/50 flex justify-between items-center">
                    <span className="font-bold text-mm-g">Total</span>
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
        </>
      )}
    </AnimatePresence>
  );
}
