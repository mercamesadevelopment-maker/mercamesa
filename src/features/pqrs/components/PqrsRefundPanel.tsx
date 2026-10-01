'use client';

import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { PQRS_LIABLE_LABELS } from '@/lib/pqrs/reasons';
import type { PqrsRefund, PqrsRefundPreview, PqrsViewer } from '@/lib/pqrs/types';

type RefundAction = 'to_money' | 'mark_paid' | 'void_store_charge';

interface PqrsRefundPanelProps {
  viewer: PqrsViewer;
  refund: PqrsRefund | null;
  preview: PqrsRefundPreview | null;
  working: boolean;
  onAction: (action: RefundAction, notes?: string) => Promise<boolean>;
}

const ESTADO: Record<NonNullable<PqrsRefund['status']>, string> = {
  credited: 'Saldo a favor acreditado',
  money_pending: 'Reembolso en dinero pendiente',
  money_paid: 'Reembolso en dinero realizado',
};

const NOTA: Record<'pending' | 'sent' | 'failed' | 'skipped', string> = {
  pending: 'en cola',
  sent: 'emitida',
  failed: 'falló',
  skipped: 'no aplica',
};

function Fila({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mm-txs">{etiqueta}</dt>
      <dd className="font-medium text-mm-g">{fmt(valor)}</dd>
    </div>
  );
}

/**
 * La plata de un caso: antes de resolver, lo que pasaría si se aprueba; después,
 * lo que pasó. Cada puesto ve lo suyo —el servidor ya recortó lo demás—.
 */
export function PqrsRefundPanel({ viewer, refund, preview, working, onAction }: PqrsRefundPanelProps) {
  const [notes, setNotes] = useState('');

  if (!refund) {
    if (!preview) return null;

    const lineas = [
      preview.itemsTotal !== null &&
        (viewer === 'buyer'
          ? `Si se aprueba, recibirás ${fmt(preview.itemsTotal)} de saldo a favor.`
          : `Devolviendo los productos marcados, el comprador recibe ${fmt(preview.itemsTotal)} de saldo a favor.`),
      preview.itemsStoreCharge !== null &&
        (viewer === 'seller'
          ? `Si aceptas, se descuentan ${fmt(preview.itemsStoreCharge)} de tu próximo pago.`
          : `Si la asume la tienda, se le descuentan ${fmt(preview.itemsStoreCharge)}.`),
      preview.orderTotal !== null && `Devolviendo el pedido completo, recibe ${fmt(preview.orderTotal)}.`,
    ].filter(Boolean);

    if (lineas.length === 0) return null;

    return (
      <div className="rounded-2xl border border-mm-crd bg-mm-gbg/30 p-4 text-sm text-mm-txs space-y-1">
        {lineas.map((l) => (
          <p key={String(l)}>{l}</p>
        ))}
      </div>
    );
  }

  const run = async (action: RefundAction) => {
    if (await onAction(action, notes)) setNotes('');
  };

  return (
    <div className="rounded-2xl border border-mm-crd bg-mm-gbg/30 p-4 space-y-3">
      <p className="flex items-center gap-2 font-bold text-mm-g">
        <Wallet className="w-4 h-4" />
        {refund.status ? ESTADO[refund.status] : 'Devolución'}
      </p>

      {refund.total !== null && (
        <p className="text-sm text-mm-txs">
          {viewer === 'buyer' ? 'Recibiste ' : 'Al comprador se le devolvieron '}
          <span className="font-bold text-mm-g">{fmt(refund.total)}</span>
          {refund.method === 'credit'
            ? ' de saldo a favor, que puedes usar en cualquier tienda.'
            : ' en dinero.'}
        </p>
      )}

      {viewer === 'seller' && (
        <p className="text-sm text-mm-txs">
          {refund.storeCharge
            ? <>Se descuentan <span className="font-bold text-mm-g">{fmt(refund.storeCharge)}</span> de tu próximo pago.</>
            : 'Esta devolución no se le descuenta a tu tienda.'}
        </p>
      )}

      {refund.breakdown && (
        <dl className="text-sm space-y-1 border-t border-mm-crd/60 pt-3">
          <Fila etiqueta="Productos" valor={refund.breakdown.products} />
          <Fila etiqueta="Comisión de servicio" valor={refund.breakdown.serviceCommission} />
          <Fila etiqueta="Servicio MercaMesa" valor={refund.breakdown.platformCommission} />
          <Fila etiqueta="Mensajes" valor={refund.breakdown.messages} />
          <Fila etiqueta="Domicilio" valor={refund.breakdown.delivery} />
          <p className="text-xs text-mm-txw pt-1">
            Los productos los asume: {PQRS_LIABLE_LABELS[refund.breakdown.liable]}
            {refund.storeCharge ? ` (descuento de ${fmt(refund.storeCharge)} en su próximo pago)` : ''}. Las comisiones
            las asume MercaMesa.
            {refund.breakdown.moneyReference && ` Referencia del reembolso: ${refund.breakdown.moneyReference}.`}
            {refund.moneyPaidAt && ` Pagado el ${fechaCompleta(refund.moneyPaidAt)}.`}
          </p>
          {refund.breakdown.creditNote && (
            <p className="text-xs text-mm-txw">
              Nota crédito en Siigo: {NOTA[refund.breakdown.creditNote.status]}
              {refund.breakdown.creditNote.number && ` (n.º ${refund.breakdown.creditNote.number})`}
              {refund.breakdown.creditNote.status !== 'sent' &&
                refund.breakdown.creditNote.error &&
                `. ${refund.breakdown.creditNote.error}`}
            </p>
          )}
        </dl>
      )}

      {(refund.can.toMoney || refund.can.markPaid || refund.can.voidStoreCharge) && (
        <div className="border-t border-mm-crd/60 pt-3 space-y-2">
          {(refund.can.markPaid || refund.can.voidStoreCharge) && (
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                refund.can.markPaid
                  ? 'Referencia del reembolso (transferencia o reversión)'
                  : 'Por qué se le quita el descuento a la tienda'
              }
            />
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            {refund.can.voidStoreCharge && (
              <Button variant="outline" size="sm" disabled={working || notes.trim().length < 10} onClick={() => run('void_store_charge')}>
                Quitar el descuento a la tienda
              </Button>
            )}
            {refund.can.toMoney && (
              <Button variant="outline" size="sm" disabled={working} onClick={() => run('to_money')}>
                Devolver en dinero
              </Button>
            )}
            {refund.can.markPaid && (
              <Button size="sm" loading={working} disabled={notes.trim().length < 4} onClick={() => run('mark_paid')}>
                Marcar el reembolso como pagado
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
