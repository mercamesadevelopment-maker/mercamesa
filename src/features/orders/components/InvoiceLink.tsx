import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import type { OrderInvoiceLink } from '@/lib/siigo/invoice-link';

interface InvoiceLinkProps {
  invoice: OrderInvoiceLink | null | undefined;
}

/** La factura de Siigo del pedido: el enlace, «en proceso», o nada si el pedido no se factura. */
export function InvoiceLink({ invoice }: InvoiceLinkProps) {
  if (!invoice) return null;

  if (invoice.state === 'processing' || !invoice.url) {
    return <p className="text-sm text-mm-txs">Factura en proceso</p>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a
        href={invoice.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-mm-g underline underline-offset-2 hover:text-mm-gm"
      >
        <FileText className="w-4 h-4" />
        Factura {invoice.number ?? ''}
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
      {invoice.draft && (
        <span className="rounded-full bg-warnl px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-warn">
          Borrador
        </span>
      )}
    </span>
  );
}
