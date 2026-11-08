import React from 'react';
import { AlertTriangle, Warehouse } from 'lucide-react';
import { PhotoGrid } from '@/components/ui/photo-grid';
import { cn } from '@/lib/utils/cn';
import { fechaCompleta } from '@/lib/dates/relative-time';
import type { BayReception } from '@/lib/logistics/bay-reception';

/**
 * Cómo recibió logística esta parte en la bahía: quién y cuándo, las fotos de
 * los productos y las bolsas, y la observación. La ven el tendero y el admin.
 */
export function BayReceptionCard({ reception }: { reception: BayReception | null }) {
  if (!reception) return null;

  return (
    <div
      className={cn(
        'rounded-3xl border p-6 shadow-sm space-y-4',
        reception.damaged ? 'bg-arcilla-clara border-arcilla' : 'bg-white border-mm-crd'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-mm-g">Recepción en la bahía</h4>
            <p className="text-xs text-mm-txs">
              {fechaCompleta(reception.receivedAt)}
              {reception.receivedByName ? ` · ${reception.receivedByName}` : ''}
            </p>
          </div>
        </div>
        {reception.damaged && (
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-arcilla-oscura">
            <AlertTriangle className="w-3.5 h-3.5" /> Llegó en mal estado
          </span>
        )}
      </div>

      <PhotoGrid photos={reception.photos} className="w-24 h-24" />

      {reception.observation ? (
        <p className="text-sm text-mm-g leading-relaxed">{reception.observation}</p>
      ) : (
        <p className="text-xs text-mm-txw">Logística no dejó observaciones.</p>
      )}
    </div>
  );
}
