'use client';

import { ExternalLink } from 'lucide-react';
import { Table } from '@/components/ui/table/components/Table';
import { fechaCompleta, fechaCorta } from '@/lib/dates/relative-time';
import type { BalanceReport } from '@/lib/accounting/test-balance';
import { periodLabel } from './balance-labels';

/** Los balances generados, para volver a abrirlos. */
export function BalanceHistory({ reports }: { reports: BalanceReport[] }) {
  const columns = [
    {
      key: 'createdAt',
      label: 'Generado',
      render: (r: BalanceReport) => (
        <div className="text-xs">
          <p className="whitespace-nowrap text-mm-txs" title={fechaCompleta(r.createdAt)}>{fechaCorta(r.createdAt)}</p>
          <p className="text-mm-txw">{r.createdByName ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'kind',
      label: 'Balance',
      render: (r: BalanceReport) => (
        <div className="text-xs">
          <p className="font-bold text-mm-g">{r.kind === 'general' ? 'General' : 'Por tercero'}</p>
          <p className="whitespace-nowrap font-mono text-mm-txs">{periodLabel(r.year, r.monthStart, r.monthEnd)}</p>
        </div>
      ),
    },
    {
      key: 'accounts',
      label: 'Cuentas',
      render: (r: BalanceReport) => (
        <span className="whitespace-nowrap font-mono text-xs text-mm-txs">
          {r.accountStart || r.accountEnd ? `${r.accountStart ?? 'primera'} – ${r.accountEnd ?? 'última'}` : 'Todas'}
          {r.includesTaxDifference && <span className="ml-1 font-sans text-mm-txw">· con diferencia fiscal</span>}
        </span>
      ),
    },
    {
      key: 'third',
      label: 'Tercero',
      render: (r: BalanceReport) =>
        r.kind === 'third_party' ? (
          <div className="text-xs">
            <p className="text-mm-txs">{r.thirdPartyName ?? 'Escrito a mano'}</p>
            <p className="font-mono text-mm-txw">
              {r.identification}
              {r.branchOffice ? ` · suc. ${r.branchOffice}` : ''}
            </p>
          </div>
        ) : (
          <span className="text-xs text-mm-txw">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="rounded-3xl border border-mm-crd bg-white">
        <Table<BalanceReport>
          data={reports}
          columns={columns}
          getRowKey={(r) => r.id}
          emptyMessage="Todavía no se ha generado ningún balance."
          actions={(r: BalanceReport) => (
            <a
              href={r.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-mm-crd px-3 py-1.5 text-xs font-bold text-mm-g hover:bg-mm-gbg"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir Excel
            </a>
          )}
        />
      </div>
      <p className="px-2 text-xs text-mm-txw">
        El Excel lo guarda Siigo. Si un enlace viejo ya no abre, genera el balance de nuevo.
      </p>
    </div>
  );
}
