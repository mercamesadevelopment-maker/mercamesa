'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-fields';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { cn } from '@/lib/utils/cn';
import { formatQuantity } from '@/lib/utils/format';
import { RECEPTION_MAX_PHOTOS, RECEPTION_OBSERVATION_MAX } from '@/lib/logistics/reception-rules';
import type { LogisticsPart } from '@/lib/logistics/orders';
import type { ReceptionForm } from '../services/logistics.service';

interface ReceptionModalProps {
  /** La parte que se recibe o cuya evidencia se completa. `null` cerrado. */
  part: LogisticsPart | null;
  /** `receive`: registrar la recepción. `edit`: agregar fotos o cambiar la observación. */
  mode: 'receive' | 'edit';
  consolidated: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (form: ReceptionForm) => Promise<void>;
}

/**
 * Cómo llegó la parte a la bahía: fotos de los productos y las bolsas (al
 * menos una para recibir), una observación y si algo llegó en mal estado.
 */
export function ReceptionModal({ part, mode, consolidated, busy, onClose, onSubmit }: ReceptionModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [observation, setObservation] = useState('');
  const [damaged, setDamaged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre: al completar la evidencia parte de lo que ya había.
  useEffect(() => {
    if (!part) return;
    setFiles([]);
    setObservation(part.reception?.observation ?? '');
    setDamaged(part.reception?.damaged ?? false);
    setError(null);
  }, [part, mode]);

  if (!part) return null;

  const recibir = mode === 'receive';
  const faltaFoto = recibir && files.length === 0;
  const faltaObservacion = damaged && !observation.trim();

  const enviar = async () => {
    if (faltaFoto) return setError('Toma al menos una foto de cómo recibiste los productos y las bolsas.');
    if (faltaObservacion) return setError('Cuenta qué llegó en mal estado.');
    setError(null);
    try {
      await onSubmit({ files, observation: observation.trim(), damaged });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la recepción.');
    }
  };

  const titulo = recibir ? `Recibir la parte de ${part.storeName}` : `Recepción de ${part.storeName}`;
  const boton = recibir ? (consolidated ? 'Recibido' : 'Registrar recepción') : 'Guardar';

  return (
    <Modal isOpen onClose={busy ? () => undefined : onClose} title={titulo} maxWidth="max-w-lg">
      <div className="p-6 space-y-5">
        {part.items.length > 0 && (
          <div className="rounded-2xl bg-mm-gbg/40 px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-mm-txw mb-1.5">Debe traer</p>
            <ul className="space-y-0.5 text-sm text-mm-g">
              {part.items.map((item, i) => (
                <li key={i}>
                  <span className="font-mono font-bold">{formatQuantity(item.quantity)}</span> {item.unit} · {item.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!recibir && part.reception && part.reception.photos.length > 0 && (
          <div>
            <p className="text-sm font-medium text-mm-txs ml-1 mb-1.5">Fotos que ya están</p>
            <PhotoGrid photos={part.reception.photos} />
          </div>
        )}

        <PhotoPicker
          files={files}
          onChange={setFiles}
          max={RECEPTION_MAX_PHOTOS}
          required={recibir}
          label={recibir ? 'Fotos de los productos y las bolsas' : 'Agregar fotos'}
        />

        <label
          className={cn(
            'flex items-start gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-colors',
            damaged ? 'border-arcilla bg-arcilla-clara' : 'border-mm-crd hover:border-mm-g/40'
          )}
        >
          <input
            type="checkbox"
            checked={damaged}
            onChange={(e) => setDamaged(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-arcilla-oscura"
          />
          <span className="text-sm">
            <span className="font-bold text-mm-g flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-arcilla-oscura" /> Algo llegó en mal estado
            </span>
            <span className="text-xs text-mm-txs">Le avisamos al tendero y a MercaMesa. El pedido sigue su curso.</span>
          </span>
        </label>

        <Textarea
          label={damaged ? 'Qué llegó mal (obligatorio)' : 'Observación (opcional)'}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          maxLength={RECEPTION_OBSERVATION_MAX}
          rows={3}
          placeholder={damaged ? 'Ej.: 3 tomates aplastados, la bolsa verde venía rota' : 'Ej.: 2 bolsas, bien selladas'}
          hint={`${observation.length}/${RECEPTION_OBSERVATION_MAX}`}
        />

        {error && (
          <p className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={enviar} loading={busy} disabled={faltaFoto || faltaObservacion}>
            {boton}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

