'use client';

import { Suspense } from 'react';
import { Calculator, CreditCard, FileMinus, Banknote, Undo2, Scale } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PAGE_SIZES, useAccountingFilters, type AccountingTab } from './hooks/use-accounting-filters';
import { useAccountingOptions } from './hooks/use-accounting-options';
import { AccountingFilters } from './components/accounting-filters';
import { PaymentsTab } from './components/payments-tab';
import { CreditNotesTab } from './components/credit-notes-tab';
import { RefundsTab } from './components/refunds-tab';
import { PayoutsSection } from './components/payouts/payouts-section';
import { BalanceTab } from './components/balance/balance-tab';

const TABS: { key: AccountingTab; label: string; icon: React.ElementType }[] = [
  { key: 'payments', label: 'Pagos', icon: CreditCard },
  { key: 'credit-notes', label: 'Notas crédito', icon: FileMinus },
  { key: 'payouts', label: 'Dispersiones', icon: Banknote },
  { key: 'refunds', label: 'Devoluciones de dinero', icon: Undo2 },
  { key: 'balance', label: 'Balance de prueba', icon: Scale },
];

export default function AccountingPage() {
  // `useSearchParams` necesita un Suspense alrededor para que el build no falle.
  return (
    <Suspense fallback={null}>
      <Accounting />
    </Suspense>
  );
}

function Accounting() {
  const f = useAccountingFilters();
  const options = useAccountingOptions();
  const tabProps = {
    query: f.pagedQuery,
    pagination: {
      page: f.page,
      onPageChange: f.setPage,
      rowsPerPage: f.pageSize,
      onRowsPerPageChange: f.setPageSize,
      rowsPerPageOptions: PAGE_SIZES,
    },
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mm-gbg text-mm-g">
          <Calculator className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl text-mm-g">Contabilidad</h1>
          <p className="text-sm text-mm-txs">
            Lo que pagan los compradores, lo que se les devuelve y lo que se les paga a las tiendas.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icono = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => f.setTab(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all',
                f.tab === tab.key
                  ? 'bg-mm-g text-white'
                  : 'border border-mm-crd bg-white text-mm-txs hover:border-mm-g/40'
              )}
            >
              <Icono className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* El balance de prueba tiene su propio formulario: los filtros de
          cliente, tienda y plaza no aplican a un reporte de Siigo. */}
      {f.tab !== 'balance' && (
        <AccountingFilters
          values={f.values}
          options={options}
          hasFilters={f.hasFilters}
          onChange={f.setFilters}
          onClear={f.clearFilters}
        />
      )}

      {f.tab === 'payments' && <PaymentsTab {...tabProps} />}
      {f.tab === 'credit-notes' && <CreditNotesTab {...tabProps} />}
      {f.tab === 'refunds' && <RefundsTab {...tabProps} />}
      {f.tab === 'balance' && <BalanceTab />}
      {f.tab === 'payouts' && (
        <div className="rounded-3xl border border-mm-crd bg-white p-6">
          <PayoutsSection query={f.filterQuery} />
        </div>
      )}
    </div>
  );
}
