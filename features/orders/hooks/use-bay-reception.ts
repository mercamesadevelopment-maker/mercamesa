import { useEffect, useState } from 'react';
import { fetchBayReceptionService, type PartEvidence } from '../services/bay-reception.service';

/**
 * La evidencia de la parte de una tienda (recepción en la bahía y fotos de la
 * tienda), solo mientras el detalle está abierto.
 */
export function useBayReception(storeOrderId: string | null, enabled: boolean): PartEvidence {
  const [evidence, setEvidence] = useState<PartEvidence>({ reception: null, store: null });

  useEffect(() => {
    if (!enabled || !storeOrderId) return;
    let vigente = true;
    setEvidence({ reception: null, store: null });
    fetchBayReceptionService(storeOrderId)
      .then((data) => vigente && setEvidence(data))
      .catch(() => {
        // Es un dato de más en el detalle: si falla, el resto sigue.
      });
    return () => {
      vigente = false;
    };
  }, [storeOrderId, enabled]);

  return evidence;
}
