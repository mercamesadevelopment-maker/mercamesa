import type { ImageMatch, ImageMatchStatus } from '@/lib/catalog-images/match-files';
import { Badge } from '@/src/components/Shared';

const BADGE: Record<ImageMatchStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
  ok: { label: 'Lista', variant: 'success' },
  replaces: { label: 'Ya tiene foto', variant: 'warning' },
  no_match: { label: 'Sin producto', variant: 'error' },
  ambiguous: { label: 'Nombre repetido', variant: 'error' },
  duplicate: { label: 'Foto repetida', variant: 'error' },
  invalid: { label: 'Archivo no válido', variant: 'error' },
};

/** Las fotos que no se van a subir tal cual: las listas ya están en el resumen. */
export function ImageMatchList({ matches }: { matches: ImageMatch[] }) {
  const revisar = matches.filter((m) => m.status !== 'ok');
  if (revisar.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-mm-g">Fotos por revisar ({revisar.length})</h3>
      <div className="max-h-64 divide-y divide-mm-gbg overflow-y-auto rounded-2xl border border-mm-crd">
        {revisar.map((m) => (
          <div key={m.index} className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-grow">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="truncate font-mono text-xs font-bold text-mm-g">{m.fileName}</span>
                <Badge variant={BADGE[m.status].variant} className="text-[10px]">
                  {BADGE[m.status].label}
                </Badge>
              </div>
              <p className="text-xs text-mm-txs">{m.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
