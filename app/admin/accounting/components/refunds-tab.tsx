'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Table } from '@/components/ui/table/components/Table';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { formatCOP } from '@/lib/utils/format';
import { fechaCompleta, fechaCorta } from '@/lib/dates/relative-time';
import type { RefundRow } from '@/lib/accounting/types';
import { useAccountingList } from '../hooks/use-accounting-list';
import { fetchMoneyRefunds, markRefundPaidService } from '../services/accounting.service';
import { TotalsCards } from './totals-cards';
import { ListState } from './list-state';
import { totalPages, type AccountingTabProps } from '../types/tab-props';

/**
 * Las devoluciones en dinero. El pago se hace por fuera (transferencia); aquí
 * se deja la constancia con su referencia.
 */
export function RefundsTab({ query, pagination }: AccountingTabProps) {
  const { data, loading, error, refetch } = useAccountingList(fetchMoneyRefunds, query);
  const [pagando, setPagando] = useState<RefundRow | null>(null);
  const [referencia, setReferencia] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);

  const cerrar = () => {
    setPagando(null);
    setReferencia('');
    setErrorPago(null);
  };

  const confirmar = async () => {
    if (!pagando) return;
    if (!referencia.trim()) {
      setErrorPago('Escribe la referencia de la transferencia.');
      return;
    }
    setGuardando(true);
    try {
      await markRefundPaidService(pagando.id, referencia.trim());
      cerrar();
      await refetch();
    } catch (e) {
      setErrorPago(e instanceof Error ? e.message : 'No se pudo registrar el pago.');
    } finally {
      setGuardando(false);
    }
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Fecha',
      render: (r: RefundRow) => (
        <span className="whitespace-nowrap text-xs text-mm-txs" title={fechaCompleta(r.createdAt)}>{fechaCorta(r.createdAt)}</span>
      ),
    },
    {
      key: 'order',
      label: 'Pedido y PQRS',
      render: (r: RefundRow) => (
        <div className="text-xs">
          <p className="whitespace-nowrap font-mono font-bold text-mm-g">{r.orderCode ?? '—'}</p>
          <p className="whitespace-nowrap font-mono text-mm-txw">{r.pqrsCode}</p>
        </div>
      ),
    },
    {
      key: 'buyer',
      label: 'Cliente',
      render: (r: RefundRow) => <span className="text-xs text-mm-txs">{r.buyerName ?? '—'}</span>,
    },
    {
      key: 'store',
      label: 'Tienda y plaza',
      render: (r: RefundRow) => (
        <div className="text-xs">
          <p className="text-mm-txs">{r.storeName ?? '—'}</p>
          <p className="text-mm-txw">{r.marketplaceName}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Monto',
      render: (r: RefundRow) => <span className="font-bold text-mm-g">{formatCOP(r.amount)}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      render: (r: RefundRow) =>
        r.status === 'money_paid' ? (
          <div className="text-xs">
            <span className="rounded-full bg-okl px-2.5 py-1 font-bold text-ok">Pagada</span>
            <p className="mt-1.5 text-mm-txw">
              Ref. <span className="font-mono">{r.reference}</span>
              {r.paidAt && ` · ${fechaCorta(r.paidAt)}`}
              {r.paidByName && ` · ${r.paidByName}`}
            </p>
          </div>
        ) : (
          <span className="rounded-full bg-warnl px-2.5 py-1 text-xs font-bold text-warn">Por pagar</span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      {data && (
        <TotalsCards
          cards={[
            {
              label: 'Por pagar',
              value: formatCOP(data.totals.pending),
              hint: devoluciones(data.totals.pendingCount),
              tone: data.totals.pendingCount ? 'warn' : 'default',
            },
            {
              label: 'Pagadas',
              value: formatCOP(data.totals.paid),
              hint: devoluciones(data.totals.paidCount),
              tone: 'ok',
            },
          ]}
        />
      )}
      <ListState loading={loading && !data} error={error}>
        <div className="rounded-3xl border border-mm-crd bg-white">
          <Table<RefundRow>
            data={data?.rows ?? []}
            columns={columns}
            getRowKey={(r) => r.id}
            emptyMessage="Ninguna devolución en dinero cumple los filtros."
            {...pagination}
            totalPages={totalPages(data)}
            actions={(r: RefundRow) =>
              r.status === 'money_pending' ? (
                <Button size="sm" className="whitespace-nowrap" onClick={() => setPagando(r)}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Marcar pagada
                </Button>
              ) : null
            }
          />
        </div>
      </ListState>

      <Modal isOpen={!!pagando} onClose={cerrar} title="Registrar el pago de la devolución" maxWidth="max-w-md">
        {pagando && (
          <form
            className="space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              confirmar();
            }}
          >
            <p className="text-sm leading-relaxed text-mm-txs">
              Confirma que ya transferiste <span className="font-bold text-mm-g">{formatCOP(pagando.amount)}</span> a{' '}
              <span className="font-bold text-mm-g">{pagando.buyerName ?? 'el cliente'}</span> por la devolución del
              pedido <span className="font-mono">{pagando.orderCode}</span>. No se puede deshacer.
            </p>
            <Input
              label="Referencia de la transferencia"
              value={referencia}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)}
              placeholder="Número o comprobante"
              autoFocus
            />
            {errorPago && <p className="text-xs font-medium text-r">{errorPago}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" loading={guardando}>
                Registrar pago
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

const devoluciones = (n: number) => `${n} ${n === 1 ? 'devolución' : 'devoluciones'}`;
