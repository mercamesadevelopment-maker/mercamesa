'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { Button } from '@/src/components/Shared';
import { PACKING_NOTES_MAX } from '@/lib/orders/packing-notes';

interface PackingNotesCardProps {
  notes: string | null;
  /** Sin esta prop la nota solo se lee (admin, logística). */
  onSave?: (notes: string) => Promise<void>;
}

/**
 * Cómo va empacada la parte de la tienda: «2 bolsas, fríos en la azul y
 * calientes en la verde». La escribe el tendero; la leen el patinador,
 * logística y el domiciliario.
 */
export function PackingNotesCard({ notes, onSave }: PackingNotesCardProps) {
  const [texto, setTexto] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTexto(notes ?? '');
    setSaved(false);
  }, [notes]);

  if (!onSave && !notes) return null;

  const cambio = texto.trim() !== (notes ?? '').trim();

  const guardar = async () => {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(texto.trim());
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar las notas de empaque.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-mm-g">¿Cómo va empacado?</h4>
          <p className="text-xs text-mm-txs">Lo leen el patinador, logística y el domiciliario.</p>
        </div>
      </div>

      {onSave ? (
        <>
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setSaved(false);
            }}
            maxLength={PACKING_NOTES_MAX}
            rows={3}
            placeholder="Ej.: va en 2 bolsas. Los fríos en la bolsa azul y los calientes en la verde."
            className="w-full rounded-2xl border border-mm-crd bg-mm-gbg/20 px-4 py-3 text-sm text-mm-g placeholder:text-mm-txw focus:border-mm-g focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-mm-txw">
              {texto.length}/{PACKING_NOTES_MAX}
            </span>
            <div className="flex items-center gap-3">
              {saved && !cambio && <span className="text-xs font-bold text-ok">Guardado</span>}
              <Button size="sm" onClick={guardar} loading={saving} disabled={!cambio}>
                Guardar
              </Button>
            </div>
          </div>
          {error && <p className="rounded-2xl bg-rl px-4 py-2 text-xs font-medium text-r">{error}</p>}
        </>
      ) : (
        <p className="text-sm text-mm-g whitespace-pre-line rounded-2xl bg-mm-gbg/30 px-4 py-3">{notes}</p>
      )}
    </div>
  );
}
