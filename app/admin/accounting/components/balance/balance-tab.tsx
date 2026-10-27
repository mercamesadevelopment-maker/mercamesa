'use client';

import { Info } from 'lucide-react';
import { useTestBalance } from '../../hooks/use-test-balance';
import { ListState } from '../list-state';
import { BalanceForm } from './balance-form';
import { BalanceHistory } from './balance-history';

/** El balance de prueba de Siigo, general o por tercero, y los ya generados. */
export function BalanceTab() {
  const { reports, loading, generating, error, generate } = useTestBalance();

  const onGenerate = async (body: Record<string, unknown>) => {
    // La pestaña se abre antes de esperar a Siigo: si se abre después, el
    // navegador la toma como una ventana emergente y la bloquea.
    const ventana = window.open('', '_blank');
    const report = await generate(body);
    if (report && ventana) ventana.location.href = report.fileUrl;
    else ventana?.close();
  };

  return (
    <div className="space-y-5">
      <BalanceForm generating={generating} onGenerate={onGenerate} />

      {error &&
        (error.notConfigured ? (
          <div className="flex items-start gap-2 rounded-2xl border border-bluel bg-bluel/40 px-4 py-3 text-sm text-blue">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {error.message}
          </div>
        ) : (
          <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error.message}</div>
        ))}

      <ListState loading={loading} error={null}>
        <BalanceHistory reports={reports} />
      </ListState>
    </div>
  );
}
