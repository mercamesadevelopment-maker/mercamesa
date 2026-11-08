'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { QuantityStepper } from '@/components/ui/quantity-stepper/QuantityStepper';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/form-fields';
import { cn } from '@/lib/utils/cn';
import { formatCOP } from '@/lib/utils/format';
import { fechaCorta } from '@/lib/dates/relative-time';
import { MAX_DESCRIPTION } from '@/lib/pqrs/rules';
import { usePqrsForm } from '../hooks/use-pqrs-form';
import { PqrsPhotoPicker } from './PqrsPhotoPicker';
import { PqrsKindPicker } from './PqrsKindPicker';
import type { PqrsKind } from '@/lib/pqrs/reasons';

interface PqrsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  as: 'buyer' | 'seller';
  storeId?: string | null;
  /** `orders.id`, que es lo que conoce «Mis Órdenes». */
  orderId?: string | null;
  storeOrderId?: string | null;
  initialReason?: string | null;
  onCreated: (created: { id: string; code: string }) => void;
}

/** La pregunta de la descripción, dicha según lo que se radica. */
const PREGUNTA: Record<PqrsKind, string> = {
  peticion: '¿Qué necesitas?',
  queja: '¿Qué pasó?',
  reclamo: '¿Qué pasó?',
  sugerencia: '¿Cuál es tu idea?',
  felicitacion: '¿Qué te gustó?',
};

/** Radicar una PQRSF: primero el tipo y después el motivo. */
export function PqrsFormModal({
  isOpen,
  onClose,
  as,
  storeId,
  orderId,
  storeOrderId,
  initialReason,
  onCreated,
}: PqrsFormModalProps) {
  const form = usePqrsForm({
    isOpen,
    as,
    storeId,
    initialOrderId: orderId,
    initialStoreOrderId: storeOrderId,
    initialReason,
    onCreated,
  });

  const { context, reason } = form;
  const order = context?.order ?? null;
  // Con el motivo elegido manda el motivo; antes, basta con que algún motivo del tipo pida pedido.
  const pidePedido = Boolean(form.kind) && (reason ? reason.order !== 'none' : form.kindReasons.some((r) => r.order !== 'none'));
  const pideProductos = Boolean(reason && reason.items !== 'none' && order);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Radicar una PQRSF" maxWidth="max-w-xl">
      {form.loadError ? (
        <p className="text-sm text-r py-6 text-center">{form.loadError}</p>
      ) : !context ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-mm-txw" />
        </div>
      ) : (
        <div className="space-y-5">
          <PqrsKindPicker kinds={form.kinds} value={form.kind} onChange={form.setKind} />

          {pidePedido && (
            <Select
              label={as === 'seller' ? 'Pedido del comprador' : 'Pedido'}
              value={form.storeOrderId ?? ''}
              onChange={(e) => form.selectOrder(e.target.value || null)}
              disabled={form.loading}
            >
              <option value="">
                {reason?.order === 'required' ? 'Elige un pedido…' : 'Ninguno en particular'}
              </option>
              {context.orders.map((o) => (
                <option key={o.storeOrderId} value={o.storeOrderId}>
                  {o.code ?? 'Pedido'} · {as === 'seller' ? o.buyerName ?? 'Comprador' : o.storeName} ·{' '}
                  {fechaCorta(o.createdAt)}
                </option>
              ))}
            </Select>
          )}

          {/* Con un solo motivo en el tipo, ya quedó elegido: solo se muestra su ayuda. */}
          {form.kindReasons.length > 1 && (
          <div>
            <Select label="Motivo" value={form.reasonKey} onChange={(e) => form.setReasonKey(e.target.value)}>
              <option value="">Elige un motivo…</option>
              {form.kindReasons.map((r) => (
                <option key={r.key} value={r.key} disabled={Boolean(order && r.unavailableWhy)}>
                  {r.label}
                </option>
              ))}
            </Select>
            {reason && <p className="text-xs text-mm-txw ml-1 mt-1.5">{reason.help}</p>}
          </div>
          )}
          {form.kindReasons.length === 1 && reason && <p className="text-xs text-mm-txw ml-1 -mt-2">{reason.help}</p>}

          {pideProductos && order && (
            <div>
              <p className="text-sm font-medium text-mm-txs ml-1 mb-1.5">
                ¿Con qué productos tuviste el problema?
              </p>
              <div className="rounded-2xl border border-mm-crd divide-y divide-mm-crd/60">
                {order.items.map((item) => {
                  const marcada = item.id in form.quantities;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        id={`pqrs-item-${item.id}`}
                        checked={marcada}
                        onChange={() => form.toggleItem(item.id, item.quantity)}
                        className="w-4 h-4 accent-mm-g shrink-0"
                      />
                      <label htmlFor={`pqrs-item-${item.id}`} className="flex-1 min-w-0 cursor-pointer">
                        <span className={cn('block text-sm break-words', marcada ? 'font-bold text-mm-g' : 'text-mm-txs')}>
                          {item.name}
                        </span>
                        <span className="block text-xs text-mm-txw">
                          {item.quantity} {item.unit ?? ''} · {formatCOP(item.unitPrice)} c/u
                        </span>
                      </label>
                      {/* La cantidad solo importa cuando el problema es con parte
                          de lo pedido: 1 de 3 aguacates. */}
                      {marcada && item.quantity > 1 && (
                        <QuantityStepper
                          qty={form.quantities[item.id]}
                          min={1}
                          max={item.quantity}
                          onChange={(next) => form.setItemQuantity(item.id, next)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Textarea
            label={PREGUNTA[form.kind || 'reclamo']}
            rows={4}
            maxLength={MAX_DESCRIPTION}
            value={form.description}
            onChange={(e) => form.setDescription(e.target.value)}
            placeholder="Cuéntanos con el mayor detalle posible."
          />

          {reason && <PqrsPhotoPicker files={form.photos} onChange={form.setPhotos} required={reason.photo} />}

          {form.submitError && (
            <p className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r" role="alert">
              {form.submitError}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-xs text-mm-txw">{form.reasonKey ? form.missing : ''}</p>
            <div className="flex gap-3 shrink-0">
              <Button variant="outline" size="md" onClick={onClose} disabled={form.submitting}>
                Cancelar
              </Button>
              <Button size="md" onClick={form.submit} loading={form.submitting} disabled={Boolean(form.missing)}>
                Radicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
