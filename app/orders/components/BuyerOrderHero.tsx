import React from 'react';
import { Check, ShoppingBag, Bike, Home, CreditCard, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { BUYER_STEPS, type BuyerProgress } from '@/lib/orders/buyer-progress';

const ICONOS = [Check, ShoppingBag, Bike, Home];

interface BuyerOrderHeroProps {
  progress: BuyerProgress;
  /** «Pedido MM-2026-000123 · Tienda · fecha». */
  meta: string;
}

/**
 * Lo primero que ve el comprador en el detalle del pedido: en qué va, en una
 * frase grande, y la barra de cuatro pasos. Las reglas están en
 * `lib/orders/buyer-progress.ts`.
 */
export function BuyerOrderHero({ progress, meta }: BuyerOrderHeroProps) {
  const { title, detail, step, tone } = progress;
  const IconoEstado = tone === 'action' ? CreditCard : XCircle;

  return (
    <section aria-live="polite" className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-extrabold leading-tight text-tinta sm:text-3xl">{title}</h2>
        {detail && <p className="mt-1 text-sm text-mm-txs">{detail}</p>}
        <p className="mt-1 text-xs text-mm-txw">{meta}</p>
      </div>

      {step === null ? (
        <div
          className={cn(
            'flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold',
            tone === 'action' ? 'bg-lima-clara text-tinta' : 'bg-mm-gbg text-mm-txs'
          )}
        >
          <IconoEstado className="h-4 w-4 shrink-0" />
          {tone === 'action' ? 'Págalo desde «Mis órdenes» con el botón «Pagar».' : 'Este pedido ya no avanza.'}
        </div>
      ) : (
        <ol className="flex items-center" aria-label="Progreso del pedido">
          {BUYER_STEPS.map((nombre, i) => {
            const Icono = ICONOS[i];
            const hecho = i < step || tone === 'done';
            const actual = i === step && tone !== 'done';
            return (
              <li key={nombre} className={cn('flex items-center', i < BUYER_STEPS.length - 1 && 'flex-1')}>
                <div className="flex flex-col items-center gap-1">
                  <span
                    aria-current={actual ? 'step' : undefined}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform duration-300 motion-reduce:transition-none',
                      hecho && 'border-tinta bg-tinta text-hueso',
                      actual && 'scale-110 border-tinta bg-lima text-tinta shadow-md',
                      !hecho && !actual && 'border-mm-crd bg-white text-mm-txw'
                    )}
                  >
                    <Icono className="h-5 w-5" />
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold sm:text-xs',
                      hecho || actual ? 'text-tinta' : 'text-mm-txw'
                    )}
                  >
                    {nombre}
                  </span>
                </div>
                {i < BUYER_STEPS.length - 1 && (
                  <span className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-mm-crd" aria-hidden>
                    <span
                      className={cn(
                        'block h-full origin-left bg-tinta transition-transform duration-500 motion-reduce:transition-none',
                        i < step || tone === 'done' ? 'scale-x-100' : 'scale-x-0'
                      )}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
