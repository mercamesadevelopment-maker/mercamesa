import { Undo2 } from 'lucide-react';
import { cn } from '@/src/components/Shared';

interface TimelineItem<S extends string> {
  id?: string;
  status: S;
  notes: string | null;
  createdAt: string;
  changedByName?: string | null;
  isReversal?: boolean;
}

interface OrderStatusTimelineProps<S extends string> {
  history: TimelineItem<S>[];
  currentStatus: S | null;
  getLabel: (status: S) => string;
  /** El panel de vendedor/admin muestra quién hizo el cambio; el comprador no. */
  showAuthor?: boolean;
}

/**
 * Línea de tiempo del historial de estados. La usan el detalle del comprador
 * (`app/orders`) y el del vendedor/admin, que antes tenían el mismo markup copiado.
 * Las correcciones (`isReversal`) se marcan para que no parezcan un avance normal.
 */
export function OrderStatusTimeline<S extends string>({
  history,
  currentStatus,
  getLabel,
  showAuthor = false,
}: OrderStatusTimelineProps<S>) {
  if (history.length === 0) {
    return (
      <div className="text-xs text-mm-txw italic">
        No hay registros de cambios de estado todavía.
      </div>
    );
  }

  return (
    <div className="relative pl-6 border-l-2 border-mm-crd/60 space-y-6 ml-2">
      {history.map((h, i) => {
        const date = new Date(h.createdAt);
        const itemDate = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const itemTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Solo el último registro es el estado vigente: con reversiones, un mismo
        // estado puede aparecer varias veces en el historial.
        const isCurrent = i === history.length - 1 && h.status === currentStatus;

        return (
          <div key={h.id || i} className="relative">
            <div
              className={cn(
                'absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white',
                isCurrent
                  ? 'bg-mm-g scale-125 ring-4 ring-mm-gbg'
                  : h.isReversal
                    ? 'bg-amber-400'
                    : 'bg-mm-crd'
              )}
            />

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-xs text-mm-g">{getLabel(h.status)}</span>
                  {h.isReversal && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase tracking-wider">
                      <Undo2 className="w-3 h-3" /> Corrección
                    </span>
                  )}
                  {showAuthor && (
                    <span className="text-[10px] text-mm-txw font-semibold">
                      por {h.changedByName || 'Sistema'}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-mm-txs font-semibold flex items-center gap-1">
                  <span>{itemDate}</span>
                  <span>{itemTime}</span>
                </div>
              </div>
              {h.notes && (
                <p
                  className={cn(
                    'text-xs italic font-medium p-2.5 rounded-xl border mt-1 leading-relaxed',
                    h.isReversal
                      ? 'text-amber-900 bg-amber-50/60 border-amber-100'
                      : 'text-mm-txs bg-slate-50 border-mm-crd/40'
                  )}
                >
                  "{h.notes}"
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
