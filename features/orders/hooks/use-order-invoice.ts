import { useEffect, useState } from 'react';
import type { OrderInvoiceLink } from '@/lib/siigo/invoice-link';
import { fetchOrderInvoiceService } from '../services/invoice.service';

/** La factura de la parte de una tienda, solo mientras el detalle está abierto. */
export function useOrderInvoice(storeOrderId: string | null, enabled: boolean) {
  const [invoice, setInvoice] = useState<OrderInvoiceLink | null>(null);

  useEffect(() => {
    if (!enabled || !storeOrderId) return;
    let vigente = true;
    setInvoice(null);
    fetchOrderInvoiceService(storeOrderId)
      .then((data) => vigente && setInvoice(data))
      .catch(() => {
        // La factura es un dato de más en el detalle: si falla, el resto sigue.
      });
    return () => {
      vigente = false;
    };
  }, [storeOrderId, enabled]);

  return invoice;
}
