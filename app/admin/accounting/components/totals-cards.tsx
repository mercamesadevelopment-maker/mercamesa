import { cn } from '@/lib/utils/cn';

export interface TotalCard {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'ok' | 'warn';
}

/** Los totales del filtro, arriba de cada pestaña. */
export function TotalsCards({ cards }: { cards: TotalCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-3xl border border-mm-crd bg-white p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-mm-txw">{c.label}</p>
          <p
            className={cn(
              'mt-1 font-display text-2xl font-extrabold',
              c.tone === 'ok' ? 'text-ok' : c.tone === 'warn' ? 'text-warn' : 'text-mm-g'
            )}
          >
            {c.value}
          </p>
          {c.hint && <p className="mt-0.5 text-xs text-mm-txw">{c.hint}</p>}
        </div>
      ))}
    </div>
  );
}
