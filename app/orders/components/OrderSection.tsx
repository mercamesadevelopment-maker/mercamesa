import React from 'react';
import { Disclosure } from '@/components/ui/disclosure/Disclosure';

interface OrderSectionProps {
  icon: React.ElementType;
  title: string;
  /** Lo que se ve sin abrir: «3 productos · $45.000». */
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/** Una sección plegable del detalle del pedido: título y resumen en una fila. */
export function OrderSection({ icon: Icon, title, summary, children, defaultOpen }: OrderSectionProps) {
  return (
    <Disclosure
      defaultOpen={defaultOpen}
      className="border-t border-mm-crd/65 py-1"
      buttonClassName="w-full justify-between gap-3 py-3 text-left [&>svg:last-child]:h-5 [&>svg:last-child]:w-5"
      label={
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mm-gbg/60 text-mm-g">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-normal text-mm-txw">{title}</span>
            {summary && <span className="block truncate text-sm font-bold text-tinta">{summary}</span>}
          </span>
        </span>
      }
    >
      <div className="pb-4">{children}</div>
    </Disclosure>
  );
}
