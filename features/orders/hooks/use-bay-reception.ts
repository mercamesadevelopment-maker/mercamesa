import { useEffect, useState } from 'react';
import type { BayReception } from '@/lib/logistics/bay-reception';
import { fetchBayReceptionService } from '../services/bay-reception.service';

/** La recepción en la bahía de la parte de una tienda, solo mientras el detalle está abierto. */
export function useBayReception(storeOrderId: string | null, enabled: boolean) {
  const [reception, setReception] = useState<BayReception | null>(null);

  useEffect(() => {
    if (!enabled || !storeOrderId) return;
    let vigente = true;
    setReception(null);
    fetchBayReceptionService(storeOrderId)
      .then((data) => vigente && setReception(data))
      .catch(() => {
        // Es un dato de más en el detalle: si falla, el resto sigue.
      });
    return () => {
      vigente = false;
    };
  }, [storeOrderId, enabled]);

  return reception;
}
