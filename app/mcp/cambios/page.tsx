import type { Metadata } from 'next';
import { BrandLogo } from '@/components/ui/brand-logo';
import { getDeploymentEnv, type DeploymentEnv } from '@/lib/env';
import { MCP_RELEASES, MCP_VERSION } from '@/lib/mcp/changelog';
import { ReleaseEntry } from './components/ReleaseEntry';

/**
 * Los cambios del MCP para el equipo de Meteor. Es pública (`lib/auth/public-paths.ts`)
 * y cada entorno muestra los suyos: staging lo que ya está en `development`,
 * producción lo que ya está en `main`.
 */

export const metadata: Metadata = {
  title: 'Cambios del MCP · MercaMesa',
  description: 'Qué cambió en el MCP de MercaMesa y en los avisos para WhatsApp, versión por versión.',
  robots: { index: false, follow: false },
};

const ENV_LABELS: Record<DeploymentEnv, string> = {
  staging: 'Staging (pruebas)',
  produccion: 'Producción',
  local: 'Local',
};

export default function McpChangelogPage() {
  const env = getDeploymentEnv();

  return (
    <main className="min-h-screen bg-hueso px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <BrandLogo />

        <h1 className="mt-8 text-3xl font-extrabold text-tinta sm:text-4xl">Cambios del MCP</h1>
        <p className="mt-3 text-mm-txs">
          Lo que cambia en las herramientas del MCP y en los avisos para WhatsApp, de lo más nuevo a lo más
          viejo. Lo que dice «Rompe compatibilidad» necesita un ajuste en Meteor.
        </p>

        <dl className="mt-6 grid gap-3 rounded-3xl bg-tinta p-5 text-hueso sm:grid-cols-3">
          <div>
            <dt className="font-mono text-xs uppercase tracking-wide text-lima">Entorno</dt>
            <dd className="mt-1 font-bold">{ENV_LABELS[env]}</dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wide text-lima">Versión actual</dt>
            <dd className="mt-1 font-mono font-medium">{MCP_VERSION}</dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-wide text-lima">MCP</dt>
            <dd className="mt-1 font-mono text-sm">/api/mcp en este dominio</dd>
          </div>
        </dl>

        <p className="mt-3 text-sm text-mm-txw">
          El servidor responde la misma versión en <code className="font-mono">serverInfo.version</code> al
          conectarse.
        </p>

        <div className="mt-8 space-y-5">
          {MCP_RELEASES.map((r, i) => (
            <ReleaseEntry key={r.version} release={r} isCurrent={i === 0} />
          ))}
        </div>
      </div>
    </main>
  );
}
