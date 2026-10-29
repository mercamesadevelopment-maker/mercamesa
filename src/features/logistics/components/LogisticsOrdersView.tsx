'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import type { LogisticsOrder } from '@/lib/logistics/orders';
import { useLogisticsOrders } from '../hooks/use-logistics-orders';
import type { LogisticsScope } from '../services/logistics.service';
import { LogisticsOrderCard } from './LogisticsOrderCard';

const PESTANAS: { id: LogisticsScope; label: string }[] = [
  { id: 'open', label: 'En la plaza' },
  { id: 'closed', label: 'Despachados' },
];

/**
 * La pantalla de logística, en `/admin/orders`: los pedidos de su plaza.
 *
 * Recibe en la bahía cada parte (del patinador o del tendero) y, cuando llega
 * el domiciliario, valida con él el código de recogida y marca «En camino».
 */
export function LogisticsOrdersView() {
  const { scope, setScope, orders, loading, error, busyId, deliveryError, dismissDeliveryError, receive, dispatch, refresh } =
    useLogisticsOrders();
  const [confirmando, setConfirmando] = useState<LogisticsOrder | null>(null);

  return (
    <div className="p-4 sm:p-8 space-y-6 pb-24 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-mm-g mb-2">Bahía de despacho</h1>
          <p className="text-mm-txs">
            Recibe las partes de cada pedido y, con el domiciliario enfrente, valida el código y márcalo en camino.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading} className="flex items-center gap-2 px-4 py-2">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Actualizar
        </Button>
      </div>

      <div className="flex gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setScope(p.id)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-bold transition-colors',
              scope === p.id ? 'bg-mm-g text-white' : 'bg-white border border-mm-crd text-mm-txs hover:border-mm-g'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="p-4 bg-rl rounded-2xl text-r text-sm font-medium">{error}</div>}

      {deliveryError && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm text-amber-900 flex-grow">
            <p className="font-bold">El pedido {deliveryError.code} está completo, pero no se pudo pedir el domiciliario.</p>
            <p>{deliveryError.message}</p>
          </div>
          <button type="button" onClick={dismissDeliveryError} className="text-xs font-bold text-amber-900 underline">
            Cerrar
          </button>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="py-12 text-center text-mm-txs">Cargando pedidos...</div>
      ) : orders.length === 0 ? (
        <div className="py-12 bg-mm-gbg/30 rounded-3xl border border-mm-crd text-center text-mm-txw">
          {scope === 'open' ? 'No hay pedidos en la plaza en este momento.' : 'Todavía no hay pedidos despachados.'}
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <LogisticsOrderCard
              key={order.orderId}
              order={order}
              busyId={busyId}
              onReceive={receive}
              onDispatch={setConfirmando}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmando !== null}
        onClose={() => setConfirmando(null)}
        onConfirm={() => {
          if (confirmando) dispatch(confirmando.orderId);
          setConfirmando(null);
        }}
        title="¿Le entregaste el pedido al domiciliario?"
        message={
          <>
            {confirmando?.booking?.pickupValidationCode ? (
              <>
                Confirma que el domiciliario te dio el código{' '}
                <strong className="font-bold text-mm-g">{confirmando.booking.pickupValidationCode}</strong>.{' '}
              </>
            ) : null}
            El pedido <strong className="font-bold text-mm-g">{confirmando?.code}</strong> pasa a «En camino».
          </>
        }
        confirmText="Sí, va en camino"
        cancelText="Todavía no"
        variant="info"
      />
    </div>
  );
}
