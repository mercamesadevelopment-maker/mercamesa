import { useEffect, useState } from 'react';
import { fetchStoreEvidenceStatus } from '../services/store-evidence.service';

/**
 * Al pedir «Listo Recogida», pregunta al servidor si esa parte pide fotos del
 * tendero (`GET /api/store-orders/[id]/evidence`). `null` mientras pregunta o
 * si no aplica. Si la consulta falla se piden las fotos: sin ellas el servidor
 * rechazaría el cambio.
 */
export function useStoreEvidenceGate(storeOrderId: string | null, nextStatus: string | null) {
  const [required, setRequired] = useState<boolean | null>(null);

  useEffect(() => {
    setRequired(null);
    if (!storeOrderId || nextStatus !== 'at_collection') return;
    let vigente = true;
    fetchStoreEvidenceStatus(storeOrderId)
      .then((r) => vigente && setRequired(r.required))
      .catch(() => vigente && setRequired(true));
    return () => {
      vigente = false;
    };
  }, [storeOrderId, nextStatus]);

  return required;
}
