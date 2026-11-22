import React from 'react';
import { Camera } from 'lucide-react';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { fechaCompleta } from '@/lib/dates/relative-time';
import type { StoreEvidence } from '@/lib/orders/store-evidence';

/**
 * Las fotos que dejó la tienda al marcar «Listo Recogida», cuando la parte no
 * la recibió logística. La ven el tendero y el admin; el comprador no.
 */
export function StoreEvidenceCard({ evidence }: { evidence: StoreEvidence | null }) {
  if (!evidence) return null;

  return (
    <div className="space-y-4 rounded-3xl border border-mm-crd bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mm-gbg/45 text-mm-g">
          <Camera className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-mm-g">Evidencia de la tienda</h4>
          <p className="text-xs text-mm-txs">
            {fechaCompleta(evidence.at)}
            {evidence.byName ? ` · ${evidence.byName}` : ''}
          </p>
        </div>
      </div>

      <PhotoGrid photos={evidence.photos} className="h-24 w-24" />

      {evidence.observation ? (
        <p className="text-sm leading-relaxed text-mm-g">{evidence.observation}</p>
      ) : (
        <p className="text-xs text-mm-txw">La tienda no dejó observaciones.</p>
      )}
    </div>
  );
}
