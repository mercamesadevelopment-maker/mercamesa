'use client';

import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { useCredit } from '../hooks/use-credit';

const MOVIMIENTO: Record<string, string> = {
  refund: 'Devolución aprobada',
  redemption: 'Usado en una compra',
  release: 'Saldo liberado de una compra que no se completó',
  reversal: 'Cambiado por un reembolso en dinero',
  adjustment: 'Ajuste de MercaMesa',
};

/**
 * El saldo a favor: lo que el comprador recibió por devoluciones aprobadas y
 * puede usar en cualquier tienda.
 */
export function CreditTab() {
  const { credit, loading, error } = useCredit();

  return (
    <motion.div
      key="credit"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 sm:space-y-6"
    >
      <h2 className="text-2xl sm:text-3xl font-fraunces text-mm-g">Saldo a favor</h2>

      {error && <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
        </div>
      ) : (
        credit && (
          <>
            <div className="bg-white rounded-3xl border border-mm-crd shadow-sm p-5 sm:p-6">
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">Disponible</p>
              <p className="text-3xl sm:text-4xl font-fraunces text-mm-g mt-1">{fmt(credit.balance)}</p>
              <p className="text-sm text-mm-txs mt-2">
                Lo recibes cuando se aprueba una devolución. Sirve para comprar en cualquier tienda y no vence.
              </p>
            </div>

            {credit.movements.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-mm-crd border-dashed">
                <p className="text-mm-txw">Aún no tienes movimientos.</p>
              </div>
            ) : (
              <ul className="bg-white rounded-3xl border border-mm-crd divide-y divide-mm-crd/60">
                {credit.movements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-mm-g break-words">{MOVIMIENTO[m.kind] ?? m.kind}</p>
                      <p className="text-xs text-mm-txw">
                        {fechaCompleta(m.createdAt)}
                        {m.orderCode && ` · Pedido ${m.orderCode}`}
                      </p>
                    </div>
                    <span className={cn('shrink-0 font-bold whitespace-nowrap', m.amount > 0 ? 'text-ok' : 'text-mm-txs')}>
                      {m.amount > 0 ? '+' : '−'}
                      {fmt(Math.abs(m.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      )}
    </motion.div>
  );
}
