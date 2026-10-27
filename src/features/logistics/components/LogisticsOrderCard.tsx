'use client';

import React from 'react';
import { CheckCircle2, Clock, KeyRound, MapPin, Package, Truck } from 'lucide-react';
import { Badge, Button, cn } from '@/src/components/Shared';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { formatCOP } from '@/lib/utils/format';
import type { LogisticsOrder, LogisticsPart } from '@/lib/logistics/orders';

const ETAPA: Record<LogisticsOrder['stage'], { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'oro' }> = {
  preparing: { label: 'Faltan partes', variant: 'warning' },
  at_bay: { label: 'Completo en la bahía', variant: 'oro' },
  dispatched: { label: 'En camino', variant: 'success' },
  closed: { label: 'Cerrado', variant: 'default' },
};

/** El estado de una parte, dicho desde lo que logística espera de ella. */
function estadoDeParte(part: LogisticsPart, order: LogisticsOrder): { label: string; listo: boolean } {
  if (part.status === 'cancelled' || part.status === 'returned') return { label: 'La tienda canceló su parte', listo: false };
  if (part.status === 'dispatched' || part.status === 'delivered') return { label: 'Despachada', listo: true };
  if (part.bayReceivedAt) return { label: 'Recibida', listo: true };
  if (!order.consolidated) {
    return part.status === 'at_collection'
      ? { label: 'Lista para el domiciliario', listo: true }
      : { label: 'La tienda la está alistando', listo: false };
  }
  if (order.carrier === 'runner') {
    if (part.collectedAt) return { label: 'El patinador la trae', listo: false };
    if (part.status === 'at_collection') return { label: 'Esperando al patinador', listo: false };
  } else if (part.status === 'at_collection') {
    return { label: 'La tienda la trae', listo: false };
  }
  return { label: 'La tienda la está alistando', listo: false };
}

interface LogisticsOrderCardProps {
  order: LogisticsOrder;
  busyId: string | null;
  onReceive: (storeOrderId: string) => void;
  onDispatch: (order: LogisticsOrder) => void;
}

/** Un pedido en la bahía: qué partes llegaron, cómo vienen empacadas y el mensajero. */
export function LogisticsOrderCard({ order, busyId, onReceive, onDispatch }: LogisticsOrderCardProps) {
  const etapa = ETAPA[order.stage];

  return (
    <article className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 border-b border-mm-gbg">
        <div>
          <h3 className="font-bold text-xl text-mm-g">Pedido {order.code}</h3>
          <p className="text-xs text-mm-txw mt-0.5">
            {order.buyerName ?? 'Comprador'} · {fechaCompleta(order.createdAt)}
            {order.marketplaceName ? ` · ${order.marketplaceName}` : ''}
          </p>
          <p className="text-xs text-mm-txs mt-1">
            {order.consolidated
              ? `${order.parts.length} tiendas · ${order.carrier === 'runner' ? 'las trae el patinador' : 'las trae cada tendero'}`
              : 'Una tienda'}
            {order.commissionAmount != null && <> · comisión del patinador {formatCOP(order.commissionAmount)}</>}
          </p>
        </div>
        <Badge variant={etapa.variant}>{etapa.label}</Badge>
      </header>

      <div className="divide-y divide-mm-gbg">
        {order.parts.map((part) => {
          const estado = estadoDeParte(part, order);
          const cancelada = part.status === 'cancelled' || part.status === 'returned';

          return (
            <section key={part.storeOrderId} className={cn('p-5 space-y-2', cancelada && 'opacity-50')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-mm-g">
                    {part.storeName} <span className="text-xs font-normal text-mm-txw">{part.code}</span>
                  </p>
                  {part.localAddress && (
                    <p className="flex items-center gap-1 text-xs text-mm-txs mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-mm-oro" /> {part.localAddress}
                    </p>
                  )}
                </div>

                {part.canReceive ? (
                  <Button
                    onClick={() => onReceive(part.storeOrderId)}
                    loading={busyId === part.storeOrderId}
                    disabled={busyId !== null}
                    className="px-4 py-2 text-sm"
                  >
                    Recibido
                  </Button>
                ) : (
                  <span className={cn('flex items-center gap-1.5 text-xs font-bold', estado.listo ? 'text-ok' : 'text-mm-txw')}>
                    {estado.listo ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    {estado.label}
                  </span>
                )}
              </div>

              {part.packingNotes ? (
                <p className="flex items-start gap-1.5 rounded-2xl bg-mm-gbg/40 px-3 py-2 text-xs text-mm-g">
                  <Package className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-bold">Empaque:</span> {part.packingNotes}
                  </span>
                </p>
              ) : (
                !cancelada && <p className="text-xs text-mm-txw">El tendero no dejó notas de empaque.</p>
              )}
            </section>
          );
        })}
      </div>

      {(order.booking || order.canDispatch) && (
        <footer className="p-5 bg-mm-gbg/40 border-t border-mm-crd/40 space-y-3">
          {order.booking ? (
            <div className="flex items-start gap-2.5 text-sm text-mm-txs">
              <Truck className="w-4 h-4 shrink-0 mt-0.5 text-mm-g" />
              <div>
                <p className="font-bold text-mm-g">
                  {order.booking.simulated ? 'Domiciliario pedido (simulacro)' : 'Domiciliario pedido'}
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
                  <p className="flex items-center gap-1.5 mt-1">
                    <KeyRound className="w-3.5 h-3.5 text-mm-g" /> Código de recogida:{' '}
                    <span className="font-bold text-lg tracking-widest text-mm-g">{order.booking.pickupValidationCode}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            order.canDispatch && (
              <p className="text-xs text-mm-txs">
                Todavía no hay domiciliario de Pibox para este pedido. Si lo despachas por fuera, márcalo igual.
              </p>
            )
          )}

          {order.canDispatch && (
            <Button
              onClick={() => onDispatch(order)}
              loading={busyId === order.orderId}
              disabled={busyId !== null}
              className="w-full py-3 flex items-center justify-center gap-2"
            >
              <Truck className="w-4 h-4" /> Entregado al domiciliario: en camino
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
