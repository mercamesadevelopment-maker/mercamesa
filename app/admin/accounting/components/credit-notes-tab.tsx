'use client';

import { Table } from '@/components/ui/table/components/Table';
import { cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { fechaCompleta, fechaCorta } from '@/lib/dates/relative-time';
import { InvoiceLink } from '@/src/features/orders/components/InvoiceLink';
import type { CreditNoteRow } from '@/lib/accounting/types';
import { useAccountingList } from '../hooks/use-accounting-list';
import { fetchCreditNotes } from '../services/accounting.service';
import { TotalsCards } from './totals-cards';
import { ListState } from './list-state';
import { totalPages, type AccountingTabProps } from '../types/tab-props';

const ESTADO: Record<string, { label: string; clase: string }> = {
  sent: { label: 'Enviada', clase: 'bg-okl text-ok' },
  pending: { label: 'Por enviar', clase: 'bg-warnl text-warn' },
  failed: { label: 'Falló', clase: 'bg-rl text-r' },
  skipped: { label: 'No aplica', clase: 'bg-mm-gbg text-mm-txw' },
};

const ASUME: Record<string, string> = { store: 'La tienda', logistics: 'Logística', platform: 'MercaMesa' };

/** Las notas crédito de Siigo, una por devolución. */
export function CreditNotesTab({ query, pagination }: AccountingTabProps) {
  const { data, loading, error } = useAccountingList(fetchCreditNotes, query);

  const columns = [
    {
      key: 'createdAt',
      label: 'Fecha',
      render: (n: CreditNoteRow) => (
        <span className="whitespace-nowrap text-xs text-mm-txs" title={fechaCompleta(n.createdAt)}>{fechaCorta(n.createdAt)}</span>
      ),
    },
    {
      key: 'document',
      label: 'Nota crédito',
      render: (n: CreditNoteRow) => {
        const e = ESTADO[n.status] ?? { label: n.status, clase: 'bg-mm-gbg text-mm-txw' };
        return (
          <div className="space-y-1">
            {n.document?.state === 'available' ? (
              <InvoiceLink invoice={n.document} label="Nota crédito" />
            ) : (
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', e.clase)}>{e.label}</span>
            )}
            {n.status === 'failed' && n.lastError && (
              <p className="max-w-xs truncate text-[11px] text-r" title={n.lastError}>{n.lastError}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'order',
      label: 'Pedido y PQRS',
      render: (n: CreditNoteRow) => (
        <div className="text-xs">
          <p className="whitespace-nowrap font-mono font-bold text-mm-g">{n.orderCode ?? '—'}</p>
          <p className="whitespace-nowrap font-mono text-mm-txw">{n.pqrsCode}</p>
        </div>
      ),
    },
    {
      key: 'buyer',
      label: 'Cliente',
      render: (n: CreditNoteRow) => <span className="text-xs text-mm-txs">{n.buyerName ?? '—'}</span>,
    },
    {
      key: 'store',
      label: 'Tienda y plaza',
      render: (n: CreditNoteRow) => (
        <div className="text-xs">
          <p className="text-mm-txs">{n.storeName ?? '—'}</p>
          <p className="text-mm-txw">{n.marketplaceName}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (n: CreditNoteRow) => (
        <div>
          <p className="font-bold text-mm-g">{fmt(n.amount)}</p>
          <p className="text-xs text-mm-txw">Asume: {ASUME[n.liable] ?? n.liable}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {data && (
        <TotalsCards
          cards={[
            { label: 'Monto en notas', value: fmt(data.totals.amount), hint: `${data.total} ${data.total === 1 ? 'nota crédito' : 'notas crédito'}` },
            { label: 'Enviadas a Siigo', value: String(data.totals.sent), tone: 'ok' },
            { label: 'Por enviar', value: String(data.totals.pending), tone: data.totals.pending ? 'warn' : 'default' },
            { label: 'Fallidas', value: String(data.totals.failed), tone: data.totals.failed ? 'warn' : 'default' },
          ]}
        />
      )}
      <ListState loading={loading && !data} error={error}>
        <div className="rounded-3xl border border-mm-crd bg-white">
          <Table<CreditNoteRow>
            data={data?.rows ?? []}
            columns={columns}
            getRowKey={(n) => n.id}
            emptyMessage="Ninguna nota crédito cumple los filtros."
            {...pagination}
            totalPages={totalPages(data)}
          />
        </div>
      </ListState>
    </div>
  );
}
