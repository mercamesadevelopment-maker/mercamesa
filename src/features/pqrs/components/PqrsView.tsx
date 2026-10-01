'use client';

import React, { useState } from 'react';
import { LifeBuoy, Loader2, Plus } from 'lucide-react';
import { Button, cn } from '@/src/components/Shared';
import { Pagination } from '@/app/orders/components/Pagination';
import { timeAgo, fechaCompleta } from '@/lib/dates/relative-time';
import { PQRS_KIND_LABELS } from '@/lib/pqrs/reasons';
import { PQRS_STATUS_LABELS, type PqrsStatus, type PqrsSummary, type PqrsViewer } from '@/lib/pqrs/types';
import { usePqrsList } from '../hooks/use-pqrs-list';
import { PqrsStatusBadge } from './PqrsStatusBadge';
import { PqrsFormModal } from './PqrsFormModal';
import { PqrsDetailModal } from './PqrsDetailModal';

interface PqrsViewProps {
  scope: PqrsViewer;
  title: string;
  subtitle: string;
  /** Tienda activa del tendero. Mientras no se conozca, el listado espera. */
  storeId?: string | null;
  /** Lo que va junto al título: el selector de tienda del tendero. */
  headerExtra?: React.ReactNode;
  /** Lo que va entre el encabezado y el listado. */
  children?: React.ReactNode;
}

const FILTERS: { value: PqrsStatus | null; label: string }[] = [
  { value: null, label: 'Todas' },
  ...(Object.keys(PQRS_STATUS_LABELS) as PqrsStatus[]).map((s) => ({ value: s, label: PQRS_STATUS_LABELS[s] })),
];

/** De quién es el caso, dicho para quien lo mira. */
function partes(item: PqrsSummary, scope: PqrsViewer): string {
  const datos: (string | null)[] = [];
  if (scope !== 'seller') datos.push(item.storeName);
  if (scope !== 'buyer') {
    datos.push(item.openedAs === 'seller' ? `Radicó la tienda (${item.openedByName ?? 'equipo'})` : item.buyerName);
  }
  datos.push(item.orderCode ? `Pedido ${item.orderCode}` : null);
  return datos.filter(Boolean).join(' · ');
}

/**
 * El listado de PQRS. Es uno solo para los tres puestos: `scope` decide qué
 * casos trae el servidor y si se puede radicar desde acá (el admin no radica).
 */
export function PqrsView({ scope, title, subtitle, storeId, headerExtra, children }: PqrsViewProps) {
  const esperaTienda = scope === 'seller' && !storeId;
  const { data, status, setStatus, page, setPage, loading, error, refresh } = usePqrsList(
    scope,
    storeId,
    !esperaTienda
  );

  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto animate-fade-up pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-fraunces text-mm-g mb-1 sm:mb-2">{title}</h1>
            <p className="text-sm sm:text-base text-mm-txs">{subtitle}</p>
          </div>
          {headerExtra}
        </div>

        {scope !== 'admin' && (
          <Button size="md" onClick={() => setShowForm(true)} disabled={esperaTienda} className="shrink-0">
            <Plus className="w-4 h-4" /> Radicar PQRS
          </Button>
        )}
      </div>

      {children}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap',
              status === f.value
                ? 'bg-mm-g text-white shadow-md'
                : 'bg-white border border-mm-crd text-mm-txs hover:border-mm-g'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r mb-4">{error}</div>}

      {loading || esperaTienda ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-mm-crd text-center flex flex-col items-center">
          <LifeBuoy className="w-12 h-12 text-mm-txw mb-3" />
          <p className="text-mm-txs">
            {status ? 'No hay casos en ese estado.' : 'Todavía no hay PQRS.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setOpenId(item.id)}
                className="w-full text-left bg-white rounded-3xl border border-mm-crd shadow-sm hover:border-mm-g transition-all p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <p className="text-[11px] text-mm-oro font-bold uppercase tracking-widest">
                    {item.code} · {PQRS_KIND_LABELS[item.kind]}
                  </p>
                  <PqrsStatusBadge status={item.status} outcome={item.outcome} />
                </div>
                <p className="font-bold text-mm-g leading-tight break-words">{item.reasonLabel}</p>
                {partes(item, scope) && <p className="text-sm text-mm-txs mt-1 break-words">{partes(item, scope)}</p>}
                <p className="text-xs text-mm-txw mt-2" title={fechaCompleta(item.createdAt)}>
                  Radicada {timeAgo(item.createdAt).toLowerCase()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} />

      {scope !== 'admin' && (
        <PqrsFormModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          as={scope}
          storeId={storeId}
          onCreated={(created) => {
            setShowForm(false);
            refresh();
            // Se abre el caso recién radicado: confirma que quedó y muestra el
            // código.
            setOpenId(created.id);
          }}
        />
      )}

      <PqrsDetailModal pqrsId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
    </div>
  );
}
