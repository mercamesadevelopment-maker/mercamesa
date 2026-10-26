'use client';

import { Table } from '@/components/ui/table/components/Table';
import { cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { fechaCompleta, fechaCorta } from '@/lib/dates/relative-time';
import type { PaymentRow } from '@/lib/accounting/types';
import { useAccountingList } from '../hooks/use-accounting-list';
import { fetchPayments } from '../services/accounting.service';
import { TotalsCards } from './totals-cards';
import { ListState } from './list-state';
import { totalPages, type AccountingTabProps } from '../types/tab-props';

const ESTADO: Record<string, { label: string; clase: string }> = {
  approved: { label: 'Aprobado', clase: 'bg-okl text-ok' },
  pending: { label: 'Pendiente', clase: 'bg-warnl text-warn' },
  processing: { label: 'En proceso', clase: 'bg-bluel text-blue' },
  rejected: { label: 'Rechazado', clase: 'bg-rl text-r' },
  refunded: { label: 'Reembolsado', clase: 'bg-mm-gbg text-mm-txw' },
  disputed: { label: 'En disputa', clase: 'bg-rl text-r' },
};

const PROVEEDOR: Record<string, string> = { zonapagos: 'ZonaPagos', saldo: 'Saldo a favor' };

/** Los pagos de los compradores: cada intento contra la pasarela y los pagos con saldo a favor. */
export function PaymentsTab({ query, pagination }: AccountingTabProps) {
  const { data, loading, error } = useAccountingList(fetchPayments, query);

  const columns = [
    {
      key: 'createdAt',
      label: 'Fecha',
      render: (p: PaymentRow) => (
        <span className="whitespace-nowrap text-xs text-mm-txs" title={fechaCompleta(p.createdAt)}>{fechaCorta(p.createdAt)}</span>
      ),
    },
    {
      key: 'order',
      label: 'Pedido',
      render: (p: PaymentRow) => (
        <div>
          <p className="whitespace-nowrap font-mono text-xs font-bold text-mm-g">{p.orderCode ?? '—'}</p>
          <p className="text-xs text-mm-txw">{p.buyerName ?? 'Cliente'}</p>
        </div>
      ),
    },
    {
      key: 'stores',
      label: 'Tienda y plaza',
      render: (p: PaymentRow) => (
        <div className="text-xs">
          <p className="text-mm-txs">{p.storeNames.join(', ') || '—'}</p>
          <p className="text-mm-txw">{p.marketplaceNames.join(', ')}</p>
        </div>
      ),
    },
    {
      key: 'method',
      label: 'Medio',
      render: (p: PaymentRow) => (
        <div className="text-xs">
          <p className="text-mm-txs">{p.method ?? '—'}</p>
          <p className="text-mm-txw">{PROVEEDOR[p.provider] ?? p.provider}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (p: PaymentRow) => {
        const e = ESTADO[p.status] ?? { label: p.status, clase: 'bg-mm-gbg text-mm-txw' };
        return <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', e.clase)}>{e.label}</span>;
      },
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (p: PaymentRow) => <span className="font-bold text-mm-g">{fmt(p.amount)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      {data && (
        <TotalsCards
          cards={[
            {
              label: 'Pagos aprobados',
              value: fmt(data.totals.approved),
              hint: `${data.totals.approvedCount} ${data.totals.approvedCount === 1 ? 'pago' : 'pagos'}`,
              tone: 'ok',
            },
            {
              label: 'Sin aprobar',
              value: fmt(data.totals.notApproved),
              hint: `${data.totals.notApprovedCount} intentos rechazados, pendientes o reembolsados`,
            },
          ]}
        />
      )}
      <ListState loading={loading && !data} error={error}>
        <div className="rounded-3xl border border-mm-crd bg-white">
          <Table<PaymentRow>
            data={data?.rows ?? []}
            columns={columns}
            getRowKey={(p) => p.id}
            emptyMessage="Ningún pago cumple los filtros."
            {...pagination}
            totalPages={totalPages(data)}
          />
        </div>
      </ListState>
    </div>
  );
}
