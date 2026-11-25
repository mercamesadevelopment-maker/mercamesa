'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bike, Check, CreditCard, Home, ShoppingBag, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useActiveOrders, type ActiveOrder } from '@/features/orders/active-orders-context';
import type { OrderDetail } from '@/app/orders/types/order.types';
import { BuyerOrderDetailModal } from './BuyerOrderDetailModal';
import { MiniSteps } from './ActiveOrderCard';

/**
 * La burbuja del pedido: acompaña al comprador por la app y le avisa cuando su
 * pedido cambia (lo aceptaron, el domiciliario va por él, va en camino, llegó).
 *
 * Cerrada es un botón redondo abajo a la derecha. Cuando el pedido avanza se
 * despliega sola unos segundos con la frase nueva y vuelve a cerrarse. La «×» la
 * oculta hasta el siguiente cambio de ese pedido, no para siempre.
 *
 * No aparece en «Mis órdenes» ni en la página de inicio, donde el pedido ya está
 * a la vista (`ActiveOrdersSection`).
 */

const SIN_BURBUJA = ['/orders', '/marketplaces'];
const DESPLEGADA_MS = 8000;
const VISTOS = 'mm:pedido-visto';
const OCULTOS = 'mm:pedido-oculto';
const SALUDO = 'mm:pedido-saludo';

const ICONOS = [Check, ShoppingBag, Bike, Home];

/** Lo guardado en el navegador puede no estar (modo privado, almacenamiento bloqueado). */
function leer(storage: 'local' | 'session', clave: string): Record<string, string> {
  try {
    const s = storage === 'local' ? window.localStorage : window.sessionStorage;
    return JSON.parse(s.getItem(clave) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function guardar(storage: 'local' | 'session', clave: string, valor: Record<string, string>) {
  try {
    const s = storage === 'local' ? window.localStorage : window.sessionStorage;
    s.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento la burbuja funciona igual; solo se despliega de más.
  }
}

const claveDe = (item: ActiveOrder) => item.order.order_code ?? `${item.order.order_id}:${item.order.store_id}`;

export function ActiveOrderBubble() {
  const pathname = usePathname();
  const router = useRouter();
  const { enabled, orders } = useActiveOrders();
  const [desplegada, setDesplegada] = useState(false);
  const [oculta, setOculta] = useState(false);
  const [abierto, setAbierto] = useState<OrderDetail | null>(null);

  const top = orders[0] ?? null;
  const clave = top ? claveDe(top) : null;
  const firma = top?.signature ?? null;
  // Donde el pedido ya está a la vista no hay burbuja, y lo que pase ahí no
  // cuenta como «visto»: al pasar a otra pantalla se despliega.
  const aquiNo = SIN_BURBUJA.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  // ¿Es nuevo para esta persona? Se compara con lo último que vio de ese pedido.
  useEffect(() => {
    if (!clave || !firma || aquiNo) return;
    setOculta(leer('local', OCULTOS)[clave] === firma);

    const vistos = leer('local', VISTOS);
    const saludo = leer('session', SALUDO);
    const esNuevo = vistos[clave] !== firma;
    const primeraVez = !saludo[clave];
    if (!esNuevo && !primeraVez) return;

    setDesplegada(true);
    guardar('local', VISTOS, { ...vistos, [clave]: firma });
    guardar('session', SALUDO, { ...saludo, [clave]: '1' });
    const t = setTimeout(() => setDesplegada(false), DESPLEGADA_MS);
    return () => clearTimeout(t);
  }, [clave, firma, aquiNo]);

  if (!enabled || !top || !clave || !firma || oculta || aquiNo) return null;

  const { progress } = top;
  const Icono = progress.tone === 'action' ? CreditCard : ICONOS[progress.step ?? 0] ?? ShoppingBag;
  const varios = orders.length > 1;

  const abrir = () => {
    if (varios) router.push('/orders');
    else setAbierto(top.order);
  };
  const ocultar = () => {
    guardar('local', OCULTOS, { ...leer('local', OCULTOS), [clave]: firma });
    setOculta(true);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[200] flex items-end gap-2 sm:bottom-6 sm:right-6">
        {/* El aviso: solo se anima transform y opacity, y se apaga con «reducir movimiento». */}
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'w-[min(18rem,calc(100vw-6rem))] origin-bottom-right rounded-3xl border border-tinta/10 bg-white p-4 shadow-xl',
            'transition-[transform,opacity] duration-300 motion-reduce:transition-none',
            desplegada ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
          )}
        >
          <div className="flex items-start gap-2">
            <button type="button" onClick={abrir} className="min-w-0 flex-1 text-left">
              <p className="font-mono text-[10px] uppercase tracking-wide text-mm-txw">
                {varios ? `Tienes ${orders.length} pedidos en curso` : `Tu pedido · ${top.order.store_name ?? ''}`}
              </p>
              <p className="mt-0.5 font-display text-base font-extrabold leading-snug text-tinta">{progress.title}</p>
              {progress.detail && <p className="mt-0.5 text-xs text-mm-txs">{progress.detail}</p>}
              <MiniSteps step={progress.step} done={progress.tone === 'done'} className="mt-3" />
            </button>
            <button
              type="button"
              onClick={ocultar}
              aria-label="Ocultar hasta que el pedido cambie"
              className="-mr-1 -mt-1 rounded-full p-1 text-mm-txw hover:bg-mm-gbg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => (desplegada ? abrir() : setDesplegada(true))}
          aria-label={`Tu pedido: ${progress.title}`}
          className={cn(
            'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-xl',
            'transition-transform duration-200 hover:scale-105 motion-reduce:transition-none',
            progress.tone === 'action' ? 'bg-lima text-tinta' : 'bg-tinta text-lima'
          )}
        >
          <Icono className="h-6 w-6" />
          {varios && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-arcilla px-1 font-mono text-[10px] font-bold text-white">
              {orders.length}
            </span>
          )}
        </button>
      </div>

      <BuyerOrderDetailModal isOpen={!!abierto} onClose={() => setAbierto(null)} order={abierto} />
    </>
  );
}
