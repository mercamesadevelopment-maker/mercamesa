'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { fmt } from '@/src/constants';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { PQRS_KIND_LABELS, PQRS_LIABLE_LABELS } from '@/lib/pqrs/reasons';
import { usePqrsDetail } from '../hooks/use-pqrs-detail';
import { PqrsStatusBadge } from './PqrsStatusBadge';
import { PqrsPhotos } from './PqrsPhotos';
import { PqrsThread } from './PqrsThread';
import { PqrsStoreResponse } from './PqrsStoreResponse';
import { PqrsResolveForm } from './PqrsResolveForm';
import { PqrsBlockPanel } from './PqrsBlockPanel';

interface PqrsDetailModalProps {
  /** `null` cierra el modal. */
  pqrsId: string | null;
  onClose: () => void;
  /** Algo cambió en el caso: el listado debe refrescarse. */
  onChanged?: () => void;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-mm-txw font-bold uppercase tracking-widest">{etiqueta}</dt>
      <dd className="text-sm text-mm-txs break-words">{children}</dd>
    </div>
  );
}

/**
 * El detalle de un caso. Es el mismo para comprador, tendero y admin: lo que
 * cambia es qué trae el servidor (`viewer` y `can`), no la pantalla.
 */
export function PqrsDetailModal({ pqrsId, onClose, onChanged }: PqrsDetailModalProps) {
  const { detail, loading, error, working, actionError, sendMessage, respondAsStore, resolve, liftBlock } =
    usePqrsDetail(pqrsId, onChanged);

  return (
    <Modal isOpen={Boolean(pqrsId)} onClose={onClose} title={detail?.code ?? 'PQRS'} maxWidth="max-w-2xl">
      {error ? (
        <p className="text-sm text-r py-6 text-center">{error}</p>
      ) : loading || !detail ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-mm-txw" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-mm-oro font-bold uppercase tracking-widest">
                {PQRS_KIND_LABELS[detail.kind]}
              </p>
              <h3 className="font-bold text-mm-g leading-tight break-words">{detail.reasonLabel}</h3>
            </div>
            <PqrsStatusBadge status={detail.status} outcome={detail.outcome} />
          </div>

          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            <Dato etiqueta="Radicada">{fechaCompleta(detail.createdAt)}</Dato>
            {detail.storeName && <Dato etiqueta="Tienda">{detail.storeName}</Dato>}
            {detail.orderCode && <Dato etiqueta="Pedido">{detail.orderCode}</Dato>}
            {/* El comprador ya sabe quién es; a los demás sí les hace falta. */}
            {detail.viewer !== 'buyer' && detail.buyerName && (
              <Dato etiqueta="Comprador">{detail.buyerName}</Dato>
            )}
            {detail.status === 'awaiting_store' && detail.storeResponseDueAt && (
              <Dato etiqueta="La tienda responde antes de">{fechaCompleta(detail.storeResponseDueAt)}</Dato>
            )}
          </dl>

          <div>
            <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-1.5">Descripción</p>
            <p className="text-sm text-mm-txs whitespace-pre-wrap break-words">{detail.description}</p>
          </div>

          {detail.items.length > 0 && (
            <div>
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-1.5">Productos</p>
              <ul className="rounded-2xl border border-mm-crd divide-y divide-mm-crd/60">
                {detail.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="text-mm-txs break-words min-w-0">
                      {item.quantity} {item.unit ?? ''} · {item.name}
                    </span>
                    <span className="font-bold text-mm-g shrink-0">{fmt(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.attachments.length > 0 && (
            <div>
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-1.5">Fotos</p>
              <PqrsPhotos attachments={detail.attachments} />
            </div>
          )}

          <PqrsBlockPanel
            history={detail.buyerHistory}
            block={detail.block}
            canLift={detail.can.liftBlock}
            working={working}
            onLift={liftBlock}
          />

          {detail.status === 'resolved' && (
            <div className="rounded-2xl bg-mm-gbg/50 border border-mm-crd p-4">
              <p className="text-xs text-mm-txw font-bold uppercase tracking-widest mb-1">Resolución</p>
              <p className="text-sm text-mm-txs whitespace-pre-wrap break-words">{detail.resolutionNotes}</p>
              <p className="text-xs text-mm-txw mt-2">
                {fechaCompleta(detail.resolvedAt)}
                {/* Al comprador no le llega: es un dato de gestión. */}
                {detail.liable && ` · Lo asume: ${PQRS_LIABLE_LABELS[detail.liable]}`}
              </p>
            </div>
          )}

          {detail.can.respondAsStore && (
            <PqrsStoreResponse dueAt={detail.storeResponseDueAt} working={working} onRespond={respondAsStore} />
          )}

          {detail.can.resolve && (
            <PqrsResolveForm reasonKey={detail.reason} working={working} onResolve={resolve} />
          )}

          {actionError && (
            <p className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r" role="alert">
              {actionError}
            </p>
          )}

          <PqrsThread
            messages={detail.messages}
            viewer={detail.viewer}
            canMessage={detail.can.message}
            working={working}
            onSend={sendMessage}
          />
        </div>
      )}
    </Modal>
  );
}
