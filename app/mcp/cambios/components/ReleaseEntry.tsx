import { Stamp } from '@/components/ui/stamp';
import { cn } from '@/lib/utils/cn';
import {
  MCP_CHANGE_KIND_LABELS,
  type McpChange,
  type McpChangeKind,
  type McpRelease,
} from '@/lib/mcp/changelog';

const KIND_ORDER: McpChangeKind[] = ['cambio', 'retirado', 'nuevo', 'corregido'];

const KIND_STYLES: Record<McpChangeKind, string> = {
  cambio: 'bg-arcilla-clara text-arcilla-oscura',
  retirado: 'bg-rl text-r',
  nuevo: 'bg-lima-clara text-tinta',
  corregido: 'bg-salvia-clara text-salvia',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** El texto con lo que va entre comillas invertidas como código: nombres de campos y herramientas. */
function WithCode({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded bg-mm-gbg px-1 py-0.5 font-mono text-[0.85em] text-tinta">
            {part}
          </code>
        ) : (
          part
        )
      )}
    </>
  );
}

function ChangeItem({ change }: { change: McpChange }) {
  return (
    <li className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <span className="shrink-0 font-mono text-sm font-medium text-tinta sm:w-48">{change.donde}</span>
      <span className="text-sm text-mm-txs">
        <WithCode text={change.detalle} />
        {change.rompe && (
          <Stamp tono="descuento" className="ml-2 align-middle">
            Rompe compatibilidad
          </Stamp>
        )}
      </span>
    </li>
  );
}

export function ReleaseEntry({ release, isCurrent }: { release: McpRelease; isCurrent: boolean }) {
  const id = `v${release.version}`;
  const breaks = release.cambios.some((c) => c.rompe);

  return (
    <article id={id} className="scroll-mt-6 rounded-3xl border border-mm-crd bg-white p-5 sm:p-7">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <a href={`#${id}`} className="font-mono text-xl font-medium text-tinta hover:underline">
          {release.version}
        </a>
        <span className="font-mono text-sm text-mm-txw">
          {DATE_FORMAT.format(new Date(`${release.fecha}T00:00:00Z`))}
        </span>
        {isCurrent && <Stamp tono="tinta">Versión actual</Stamp>}
        {breaks && <Stamp tono="descuento">Requiere ajustes</Stamp>}
      </header>

      <p className="mt-3 text-base text-mm-txs">{release.resumen}</p>

      <div className="mt-5 space-y-5">
        {KIND_ORDER.map((kind) => {
          const changes = release.cambios.filter((c) => c.tipo === kind);
          if (changes.length === 0) return null;
          return (
            <section key={kind}>
              <h3
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 font-mono text-xs font-medium uppercase tracking-wide',
                  KIND_STYLES[kind]
                )}
              >
                {MCP_CHANGE_KIND_LABELS[kind]}
              </h3>
              <ul className="mt-3 space-y-3">
                {changes.map((c, i) => (
                  <ChangeItem key={i} change={c} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}
