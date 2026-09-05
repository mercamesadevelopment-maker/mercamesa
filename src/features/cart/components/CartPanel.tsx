"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingCart,
  ShoppingBag,
  X,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { useCheckout } from "../hooks/useCheckout";
import { useCart } from "../hooks/use-cart";
import { Button, Badge, cn } from "@/src/components/Shared";
import { fmt } from "@/src/constants";
import { ConfirmModal } from "@/components/ui/confirm-modal/ConfirmModal";
import { DeliveryAddressSelector } from "./DeliveryAddressSelector";
import { CARD_TOKENIZATION_ENABLED } from "@/src/features/payment/config";
import { CartItem } from "@/src/types";

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckoutStep = 1 | 2;

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: 1, label: "Productos" },
  { id: 2, label: "Entrega y pago" },
];

export function CartPanel({ isOpen, onClose }: CartPanelProps) {
  const { updateCartQty, updateCartItemNotes } = useCart();
  const {
    isPlacingOrder,
    errorMessage,
    cartByStore,
    subtotal,
    quote,
    isQuoting,
    quoteError,
    canPlaceOrder,
    getPrice,
    handlePlaceOrder,
    saveCard,
    setSaveCard,
    savedPaymentMethods,
    paymentChoice,
    setPaymentChoice,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    selectedAddressId,
    setSelectedAddressId,
  } = useCheckout();

  const [deletingItem, setDeletingItem] = React.useState<CartItem | null>(null);
  const [step, setStep] = React.useState<CheckoutStep>(1);

  const isEmpty = cartByStore.length === 0;

  // Al cerrar el panel se vuelve al inicio, para no reabrirlo a mitad del flujo.
  React.useEffect(() => {
    if (!isOpen) setStep(1);
  }, [isOpen]);

  // Si el carrito se vacía estando en el paso 2 (p. ej. al quitar el último
  // producto), quedarse ahí no tendría sentido.
  React.useEffect(() => {
    if (isEmpty) setStep(1);
  }, [isEmpty]);

  const handleDecrement = (item: CartItem) => {
    if (item.qty === 1) {
      setDeletingItem(item);
    } else {
      updateCartQty(item.id, item.qty - 1);
    }
  };

  /**
   * Mismo desglose que la factura: tres conceptos. Lo que el comprador ve antes
   * de pagar es idéntico a lo que le llega facturado.
   */
  const totalsBreakdown = quoteError ? (
    // No es culpa del comprador ni algo que él pueda corregir, así que se usa el
    // aviso ámbar y no el rojo de error.
    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
      <p className="text-xs text-amber-900 leading-relaxed">{quoteError}</p>
    </div>
  ) : isQuoting || !quote ? (
    <div className="space-y-2.5 animate-pulse">
      <div className="flex justify-between text-mm-txs text-sm">
        <span>Calculando el total de tu pedido...</span>
      </div>
      <div className="h-2 bg-mm-crd/60 rounded-full w-3/4" />
      <div className="h-2 bg-mm-crd/60 rounded-full w-1/2" />
    </div>
  ) : (
    <div className="space-y-2.5">
      <div className="flex justify-between text-mm-txs text-sm">
        <span>Productos y servicio de compra</span>
        <span className="font-bold">{fmt(quote.netPurchase)}</span>
      </div>
      <div className="flex justify-between text-mm-txs text-sm">
        <span>Domicilio</span>
        <span className="font-bold">{fmt(quote.deliveryFee)}</span>
      </div>
      <div className="flex justify-between text-mm-txs text-sm">
        <span>Servicio MercaMesa</span>
        <span className="font-bold">{fmt(quote.platformCommission)}</span>
      </div>
      <div className="pt-3 border-t border-mm-crd/50 flex justify-between items-center">
        <span className="font-bold text-mm-g">Total a pagar</span>
        <span className="text-2xl font-bold text-mm-g">{fmt(quote.total)}</span>
      </div>
    </div>
  );

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
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[210] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-mm-gbg">
            <div className="flex items-center justify-between">
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

            {/* Indicador de pasos */}
            {!isEmpty && (
              <div className="flex items-center gap-2 mt-4">
                {STEPS.map((s, idx) => {
                  const isActive = step === s.id;
                  const isDone = step > s.id;
                  // Solo se puede retroceder: avanzar es responsabilidad del pie,
                  // que valida antes de dejar continuar.
                  const canNavigate = isDone;
                  return (
                    <React.Fragment key={s.id}>
                      <button
                        type="button"
                        onClick={() => canNavigate && setStep(s.id)}
                        disabled={!canNavigate && !isActive}
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-bold transition-colors",
                          isActive
                            ? "text-mm-g"
                            : isDone
                              ? "text-mm-txs hover:text-mm-g cursor-pointer"
                              : "text-mm-txw",
                          !canNavigate && !isActive && "cursor-default",
                        )}
                      >
                        <span
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                            isActive
                              ? "bg-mm-g text-white"
                              : isDone
                                ? "bg-mm-gbg text-mm-g border border-mm-g/30"
                                : "bg-mm-gbg text-mm-txw",
                          )}
                        >
                          {s.id}
                        </span>
                        {s.label}
                      </button>
                      {idx < STEPS.length - 1 && (
                        <span className="flex-grow h-px bg-mm-crd/60" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cuerpo */}
          <div className="flex-grow overflow-y-auto p-6">
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-mm-txw opacity-60">
                <ShoppingBag className="w-16 h-16 mb-4" />
                <p className="font-medium text-lg">Tu canasta está vacía</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step-products"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* Agrupado por tienda (siempre una sola tienda por carrito) */}
                    {cartByStore.map((group, groupIdx) => (
                      <div
                        key={group.store.id || groupIdx}
                        className="bg-white border border-mm-crd/40 rounded-2xl p-4 space-y-4 shadow-sm"
                      >
                        {/* Store Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-mm-gbg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {group.store.emoji || "🏪"}
                            </span>
                            <h3 className="font-bold text-mm-g text-base leading-tight">
                              {group.store.name}
                            </h3>
                          </div>
                          {/* El envío ya no es un valor fijo: se cotiza con el
                              operador logístico según la dirección, así que solo
                              se anuncia que cada tienda despacha por separado. */}
                          <Badge variant="oro" className="text-[10px]">
                            Envío propio
                          </Badge>
                        </div>

                        {/* Store Products */}
                        {group.items.map((item, itemIdx) => (
                          <div
                            key={item.id || itemIdx}
                            className="flex flex-col border-b border-mm-gbg/50 pb-3 last:border-0 last:pb-0"
                          >
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
                                  Unidad:{" "}
                                  <span className="font-bold text-mm-txs">
                                    {item.unit || "und"}
                                  </span>
                                </p>

                                {/* Alerta de oferta expirada */}
                                {item.offerExpired && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg mt-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
                                    <span>
                                      La oferta venció. Se aplicó el precio
                                      regular.
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-baseline gap-1">
                                    <p className="font-bold text-mm-g text-sm">
                                      {fmt(getPrice(item))}
                                    </p>
                                    <span className="text-[10px] text-mm-txw">
                                      / {item.unit || "und"}
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
                                Indicación especial (ej: más verde, más
                                maduro...)
                              </label>
                              <input
                                type="text"
                                value={item.notes || ""}
                                onChange={(e) =>
                                  updateCartItemNotes(item.id, e.target.value)
                                }
                                placeholder="Ej: tomates medianamente verdes..."
                                className="w-full px-3 py-1.5 rounded-xl border border-mm-crd/40 bg-mm-gbg/15 text-xs text-mm-g focus:border-mm-g outline-none transition-all placeholder:text-mm-txw/60"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-checkout"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <DeliveryAddressSelector
                      selectedAddressId={selectedAddressId}
                      onSelect={setSelectedAddressId}
                    />

                    {CARD_TOKENIZATION_ENABLED &&
                      savedPaymentMethods.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-bold text-mm-g">
                            Medio de pago
                          </h3>
                          <label className="flex items-center gap-2 text-sm text-mm-txs cursor-pointer">
                            <input
                              type="radio"
                              name="payment-choice"
                              checked={paymentChoice === "saved"}
                              onChange={() => setPaymentChoice("saved")}
                            />
                            Pagar con tarjeta guardada
                          </label>
                          {paymentChoice === "saved" &&
                            savedPaymentMethods.length > 1 && (
                              <select
                                value={selectedPaymentMethodId || ""}
                                onChange={(e) =>
                                  setSelectedPaymentMethodId(e.target.value)
                                }
                                className="w-full ml-6 px-3 py-2 rounded-xl border border-mm-crd bg-white text-sm text-mm-g outline-none"
                              >
                                {savedPaymentMethods.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          <label className="flex items-center gap-2 text-sm text-mm-txs cursor-pointer">
                            <input
                              type="radio"
                              name="payment-choice"
                              checked={paymentChoice === "new"}
                              onChange={() => setPaymentChoice("new")}
                            />
                            Pagar con tarjeta nueva
                          </label>
                        </div>
                      )}

                    {CARD_TOKENIZATION_ENABLED && paymentChoice === "new" && (
                      <label className="flex items-center gap-2 text-sm text-mm-txs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveCard}
                          onChange={(e) => setSaveCard(e.target.checked)}
                        />
                        Guardar esta tarjeta para futuros pagos
                      </label>
                    )}

                    {/* Resumen */}
                    <div className="bg-mm-gbg/40 rounded-2xl p-4 border border-mm-crd/40">
                      {totalsBreakdown}
                    </div>

                    {/* Advertencia antes de pagar (antes era un ConfirmModal aparte) */}
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <div className="text-xs text-amber-900 leading-relaxed">
                        <p className="font-bold mb-1">¡Ojo pues!</p>
                        <p>
                          Antes de finalizar y pagar, verifica los detalles de
                          tu pedido. Revisa los productos y las cantidades para
                          confirmar que todo esté correcto y completo. Ten en
                          cuenta que, una vez finalizado el pago, no será
                          posible agregar más productos a esta orden.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Pie */}
          {!isEmpty && (
            <div className="p-6 bg-mm-gbg/50 border-t border-mm-crd/30">
              {errorMessage && (
                <div className="mb-4 p-3 bg-rl rounded-xl text-r text-sm font-medium">
                  {errorMessage}
                </div>
              )}

              {step === 1 ? (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-mm-txs">
                      Subtotal <span className="text-mm-txw">(sin envío)</span>
                    </span>
                    <span className="text-xl font-bold text-mm-g">
                      {fmt(subtotal)}
                    </span>
                  </div>
                  <Button
                    onClick={() => setStep(2)}
                    className="w-full py-4 text-lg"
                  >
                    Continuar
                  </Button>
                </>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={isPlacingOrder}
                    className="px-5 py-4 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Volver
                  </Button>
                  <Button
                    onClick={() => handlePlaceOrder(onClose)}
                    loading={isPlacingOrder}
                    // Sin cotización no hay un total que cobrar, así que no se
                    // puede pagar.
                    disabled={!selectedAddressId || !canPlaceOrder}
                    className="flex-grow py-4 text-lg"
                  >
                    Confirmar y pagar
                  </Button>
                </div>
              )}

              {step === 2 && !selectedAddressId && (
                <p className="text-[11px] text-mm-txw text-center mt-2">
                  Selecciona una dirección de entrega para continuar.
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ConfirmModal para eliminar producto de canasta */}
      <ConfirmModal
        key="confirm-delete-item"
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
