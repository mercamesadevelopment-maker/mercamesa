'use client';

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, cn } from '@/src/components/Shared';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import type { RunnerOrder } from '@/lib/runner/orders';
import { useRunnerOrders } from '../hooks/use-runner-orders';
import type { RunnerScope } from '../services/runner.service';
import { RunnerOrderCard } from './RunnerOrderCard';

const PESTANAS: { id: RunnerScope; label: string }[] = [
  { id: 'open', label: 'Por armar' },
  { id: 'closed', label: 'Despachados' },
];

/**
 * La pantalla del patinador: los pedidos de varias tiendas de sus plazas.
 *
 * Recoge la parte de cada tienda y, con todo en la bahía, pide el mensajero.
 * Pedirlo se confirma: manda a una persona hasta la plaza.
 */
export function RunnerOrdersView() {
  const {
    scope,
    setScope,
    orders,
    loading,
    error,
    busyId,
    deliveryError,
    dismissDeliveryError,
    collect,
    markAtBay,
    refresh,
  } = useRunnerOrders();

  const [confirmando, setConfirmando] = useState<RunnerOrder | null>(null);

  return (
    <div className="p-4 sm:p-8 space-y-6 pb-24 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-fraunces text-mm-g mb-2">Pedidos por recoger</h1>
          <p className="text-mm-txs">
            Recoge la parte de cada tienda, llévala a la bahía y pide el mensajero.
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
            <p className="font-bold">
              El pedido {deliveryError.code} quedó en la bahía, pero no se pudo pedir el mensajero.
            </p>
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
          {scope === 'open' ? 'No hay pedidos por armar en este momento.' : 'Todavía no has despachado pedidos.'}
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <RunnerOrderCard
              key={order.orderId}
              order={order}
              busyId={busyId}
              onCollect={collect}
              onMarkAtBay={setConfirmando}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmando !== null}
        onClose={() => setConfirmando(null)}
        onConfirm={() => {
          if (confirmando) markAtBay(confirmando.orderId);
          setConfirmando(null);
        }}
        title="¿El pedido está completo en la bahía?"
        message={
          <>
            Al confirmar se pide el mensajero para el pedido{' '}
            <strong className="font-bold text-mm-g">{confirmando?.code}</strong>. Revisa que estén los productos de
            todas las tiendas.
          </>
        }
        confirmText="Sí, pedir el mensajero"
        cancelText="Todavía no"
        variant="info"
      />
    </div>
  );
}
