'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { BUYER_STEPS } from '@/lib/orders/buyer-progress';
import { formatOrderCode } from '@/lib/orders/order-code';
import type { ActiveOrder } from '@/features/orders/active-orders-context';

/** La barra de cuatro pasos, en chico. La grande está en `BuyerOrderHero`. */
export function MiniSteps({ step, done, className }: { step: number | null; done: boolean; className?: string }) {
  if (step === null) return null;
  return (
    <div className={cn('flex gap-1', className)} aria-label={`Paso ${step + 1} de ${BUYER_STEPS.length}: ${BUYER_STEPS[step]}`}>
      {BUYER_STEPS.map((nombre, i) => (
        <span
          key={nombre}
          className={cn('h-1.5 flex-1 rounded-full', i < step || done ? 'bg-tinta' : i === step ? 'bg-lima' : 'bg-mm-crd')}
        />
      ))}
    </div>
  );
}

/**
 * Un pedido en curso, arriba de la página de inicio: en qué va, en una frase, y
 * la barra de pasos. Al tocarlo se abre el detalle de siempre.
 */
export function ActiveOrderCard({ item, onOpen }: { item: ActiveOrder; onOpen: () => void }) {
  const { order, progress } = item;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'mm-lift w-full rounded-[28px] border p-5 text-left shadow-sm sm:p-6',
        progress.tone === 'action' ? 'border-tinta/20 bg-lima-clara' : 'border-mm-crd bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wide text-mm-txw">
            Tu pedido · {formatOrderCode(order.order_code, order.order_id)}
            {order.store_name ? ` · ${order.store_name}` : ''}
          </p>
          <h3 className="mt-1 font-display text-xl font-extrabold leading-tight text-tinta sm:text-2xl">{progress.title}</h3>
          {progress.detail && <p className="mt-1 text-sm text-mm-txs">{progress.detail}</p>}
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-1 rounded-full bg-tinta px-3 py-1.5 text-xs font-semibold text-hueso">
          Ver <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <MiniSteps step={progress.step} done={progress.tone === 'done'} className="mt-4" />
    </button>
  );
}
