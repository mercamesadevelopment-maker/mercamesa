'use client';

import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-fields';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { formatQuantity } from '@/lib/utils/format';
import {
  STORE_EVIDENCE_MAX_PHOTOS,
  STORE_EVIDENCE_REQUIRED_MESSAGE,
  STORE_OBSERVATION_MAX,
} from '@/lib/orders/store-evidence-rules';
import type { OrderItem } from '@/lib/orders/types';

export interface StoreEvidenceForm {
  files: File[];
  observation: string;
  notes: string;
}

interface StoreEvidenceModalProps {
  isOpen: boolean;
  /** Lo que debe llevar el paquete, para revisarlo antes de la foto. */
  items: OrderItem[];
  orderCode: string;
  warning?: string | null;
  onClose: () => void;
  onConfirm: (form: StoreEvidenceForm) => Promise<void>;
}

/**
 * «Listo Recogida» cuando la parte no la recibe logística: el tendero deja
 * fotos de los productos y las bolsas (al menos una) antes de pedir el
 * domiciliario. Las reglas están en `lib/orders/store-evidence-rules.ts`.
 */
export function StoreEvidenceModal({ isOpen, items, orderCode, warning, onClose, onConfirm }: StoreEvidenceModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [observation, setObservation] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFiles([]);
    setObservation('');
    setNotes('');
    setError(null);
  }, [isOpen]);

  const enviar = async () => {
    if (files.length === 0) return setError(STORE_EVIDENCE_REQUIRED_MESSAGE);
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ files, observation: observation.trim(), notes: notes.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar el pedido como listo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => undefined : onClose} title="Listo para recoger" maxWidth="max-w-lg">
      <div className="space-y-5 p-6">
        <div className="flex items-start gap-3 rounded-2xl bg-lima-clara px-4 py-3 text-sm text-tinta">
          <Camera className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Toma fotos de los productos y las bolsas del pedido <span className="font-mono font-bold">{orderCode}</span>{' '}
            antes de entregarlo. Son la evidencia de cómo salió de tu tienda.
          </p>
        </div>

        {items.length > 0 && (
          <div className="rounded-2xl bg-mm-gbg/40 px-4 py-3">
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-mm-txw">Debe llevar</p>
            <ul className="space-y-0.5 text-sm text-mm-g">
              {items.map((item, i) => (
                <li key={i}>
                  <span className="font-mono font-bold">{formatQuantity(item.qty)}</span> {item.unit} · {item.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <PhotoPicker
          files={files}
          onChange={(f) => {
            setFiles(f);
            setError(null);
          }}
          max={STORE_EVIDENCE_MAX_PHOTOS}
          required
          label="Fotos de los productos y las bolsas"
        />

        <Textarea
          label="Observación (opcional)"
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          maxLength={STORE_OBSERVATION_MAX}
          rows={2}
          placeholder="Ej.: 2 bolsas, el aguacate va aparte"
          hint={`${observation.length}/${STORE_OBSERVATION_MAX}`}
        />

        <Textarea
          label="Nota para el historial (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
        />

        {warning && <p className="rounded-2xl bg-mm-orl px-4 py-3 text-sm text-arcilla-oscura">{warning}</p>}

        {error && (
          <p className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={enviar} loading={busy} disabled={files.length === 0}>
            Listo Recogida
          </Button>
        </div>
      </div>
    </Modal>
  );
}
