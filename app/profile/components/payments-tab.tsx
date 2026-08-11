'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { usePayments } from '../hooks/use-payments';
import { Badge } from '@/src/components/Shared';
import { CreditCard, Trash2, Loader2 } from 'lucide-react';
import { CARD_TOKENIZATION_ENABLED } from '@/src/features/payment/config';

export function PaymentsTab() {
  const { paymentMethods, loading, error, fetchPaymentMethods, deletePaymentMethod } = usePayments();

  useEffect(() => {
    fetchPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deletePaymentMethod(id);
    } catch {
      // error visible en el banner superior
    }
  };

  return (
      <motion.div
        key="payments"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-fraunces text-mm-g">Medios de Pago</h2>
            <p className="text-sm text-mm-txw mt-1">
              {CARD_TOKENIZATION_ENABLED
                ? 'Se guardan automáticamente cuando marcas "Guardar esta tarjeta" al pagar un pedido.'
                : 'Guardar tarjetas está deshabilitado por ahora. Las que ya tenías siguen aquí y puedes eliminarlas cuando quieras.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {loading && paymentMethods.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-mm-crd border-dashed">
              <p className="text-mm-txw">No tienes medios de pago guardados.</p>
            </div>
          ) : (
            paymentMethods.map((pay) => (
              <div
                key={pay.id}
                className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm flex items-center gap-6"
              >
                <div className="w-14 h-14 bg-mm-gbg rounded-2xl flex items-center justify-center text-3xl shrink-0 text-mm-g">
                  <CreditCard className="w-7 h-7" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-mm-g">{pay.label}</h4>
                    {pay.is_default && (
                      <Badge variant="success" className="text-[10px]">
                        Predeterminado
                      </Badge>
                    )}
                  </div>
                  {pay.exp && <p className="text-sm text-mm-txs">Vence: {pay.exp}</p>}
                </div>
                <button
                  className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
                  onClick={() => handleDelete(pay.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
  );
}
