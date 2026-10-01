'use client';

import React from 'react';
import { CheckCircle2, Clock, MapPin, PackageCheck, Truck } from 'lucide-react';
import { Badge, Button, cn } from '@/src/components/Shared';
import { fechaCompleta } from '@/lib/dates/relative-time';
import type { RunnerOrder, RunnerPart } from '@/lib/runner/orders';

/** Cómo se le dice al patinador en qué va cada pedido. */
const ETAPA: Record<RunnerOrder['stage'], { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'oro' }> = {
  preparing: { label: 'Las tiendas están alistando', variant: 'default' },
  collecting: { label: 'Hay partes por recoger', variant: 'warning' },
  ready_for_bay: { label: 'Todo recogido', variant: 'oro' },
  at_bay: { label: 'En bahía, esperando mensajero', variant: 'info' },
  dispatched: { label: 'Despachado', variant: 'success' },
  closed: { label: 'Cerrado', variant: 'default' },
};

/** El estado de una parte, dicho desde lo que el patinador tiene que hacer. */
function estadoDeParte(part: RunnerPart): { label: string; listo: boolean } {
  if (part.status === 'cancelled' || part.status === 'returned') return { label: 'La tienda canceló su parte', listo: false };
  if (part.collectedAt) return { label: 'Recogido', listo: true };
  if (part.status === 'at_collection') return { label: 'Lista para recoger', listo: false };
  if (part.status === 'dispatched' || part.status === 'delivered') return { label: 'Despachado', listo: true };
  return { label: 'La tienda la está alistando', listo: false };
}

interface RunnerOrderCardProps {
  order: RunnerOrder;
  /** Id de la parte o del pedido con una acción en curso. */
  busyId: string | null;
  onCollect: (storeOrderId: string) => void;
  onMarkAtBay: (order: RunnerOrder) => void;
}

/** Un pedido de varias tiendas, con lo que falta por recoger en cada una. */
export function RunnerOrderCard({ order, busyId, onCollect, onMarkAtBay }: RunnerOrderCardProps) {
  const etapa = ETAPA[order.stage];

  return (
    <article className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 border-b border-mm-gbg">
        <div>
          <h3 className="font-fraunces text-xl text-mm-g">Pedido {order.code}</h3>
          <p className="text-xs text-mm-txw mt-0.5">
            {order.buyerName ?? 'Comprador'} · {fechaCompleta(order.createdAt)}
            {order.marketplaceName ? ` · ${order.marketplaceName}` : ''}
          </p>
        </div>
        <Badge variant={etapa.variant}>{etapa.label}</Badge>
      </header>

      <div className="divide-y divide-mm-gbg">
        {order.parts.map((part) => {
          const estado = estadoDeParte(part);
          const cancelada = part.status === 'cancelled' || part.status === 'returned';

          return (
            <section key={part.storeOrderId} className={cn('p-5 space-y-3', cancelada && 'opacity-50')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-mm-g">{part.storeName}</p>
                  {part.localAddress && (
                    <p className="flex items-center gap-1 text-xs text-mm-txs mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-mm-oro" /> {part.localAddress}
                    </p>
                  )}
                </div>

                {part.canCollect ? (
                  <Button
                    onClick={() => onCollect(part.storeOrderId)}
                    loading={busyId === part.storeOrderId}
                    disabled={busyId !== null}
                    className="px-4 py-2 text-sm"
                  >
                    Recogido
                  </Button>
                ) : (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-bold',
                      estado.listo ? 'text-ok' : 'text-mm-txw'
                    )}
                  >
                    {estado.listo ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    {estado.label}
                  </span>
                )}
              </div>

              <ul className="space-y-1">
                {part.items.map((item, idx) => (
                  <li key={idx} className="text-sm text-mm-txs">
                    <span className="font-bold text-mm-g">
                      {item.quantity} {item.unit}
                    </span>{' '}
                    {item.name}
                    {item.notes && <span className="block text-xs text-mm-txw">Indicación: {item.notes}</span>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {(order.canMarkAtBay || order.booking) && (
        <footer className="p-5 bg-mm-gbg/40 border-t border-mm-crd/40 space-y-3">
          {order.booking && (
            <div className="flex items-start gap-2.5 text-sm text-mm-txs">
              <Truck className="w-4 h-4 shrink-0 mt-0.5 text-mm-g" />
              <div>
                <p className="font-bold text-mm-g">
                  {order.booking.simulated ? 'Mensajero pedido (simulacro)' : 'Mensajero pedido'}
                </p>
                {order.booking.driverName ? (
                  <p>
                    {order.booking.driverName}
                    {order.booking.vehiclePlates ? ` · ${order.booking.vehiclePlates}` : ''}
                    {order.booking.driverPhone ? ` · ${order.booking.driverPhone}` : ''}
                  </p>
                ) : (
                  <p>Buscando conductor.</p>
                )}
                {order.booking.pickupValidationCode && (
                  <p>
                    Código de recogida:{' '}
                    <span className="font-bold text-mm-g">{order.booking.pickupValidationCode}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {order.canMarkAtBay && (
            <Button
              onClick={() => onMarkAtBay(order)}
              loading={busyId === order.orderId}
              disabled={busyId !== null}
              className="w-full py-3 flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              {/* Con la bahía ya marcada, lo único que falta es el mensajero. */}
              {order.bayReadyAt ? 'Volver a pedir el mensajero' : 'En bahía: pedir el mensajero'}
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
