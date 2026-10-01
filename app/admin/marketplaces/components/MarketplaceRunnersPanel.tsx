'use client';

import React from 'react';
import { useMarketplaceRunners } from '../hooks/use-marketplace-runners';

interface MarketplaceRunnersPanelProps {
  marketplaceId: string | null | undefined;
  /** Se consulta solo con el modal abierto. */
  enabled: boolean;
}

/**
 * Qué patinadores atienden la plaza.
 *
 * Los patinadores arman en la bahía los pedidos de varias tiendas. Acá solo se
 * elige entre los usuarios que ya tienen ese rol; crearlos es cosa del módulo
 * de Usuarios.
 */
export function MarketplaceRunnersPanel({ marketplaceId, enabled }: MarketplaceRunnersPanelProps) {
  const { runners, loading, saving, error, toggle } = useMarketplaceRunners(marketplaceId, enabled);

  return (
    <div>
      <h3 className="text-sm font-bold text-mm-g uppercase tracking-widest mb-1">
        Patinadores ({runners.filter((r) => r.assigned).length})
      </h3>
      <p className="text-xs text-mm-txw mb-3">
        Recogen en las tiendas y arman en la bahía los pedidos de varias tiendas de esta plaza.
      </p>

      {error && <div className="mb-3 p-3 bg-rl rounded-xl text-r text-sm font-medium">{error}</div>}

      {loading ? (
        <div className="p-6 text-center text-mm-txw text-sm">Cargando patinadores...</div>
      ) : runners.length === 0 ? (
        <div className="text-center p-6 bg-mm-gbg/30 rounded-2xl border border-mm-crd/50 text-mm-txw text-sm">
          No hay usuarios con rol de patinador. Créalos en Usuarios y vuelve para asignarlos.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {runners.map((runner) => (
            <label
              key={runner.userId}
              className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-mm-crd/60 cursor-pointer hover:border-mm-g/40 transition-all"
            >
              <input
                type="checkbox"
                checked={runner.assigned}
                disabled={saving}
                onChange={() => toggle(runner.userId)}
                className="w-4 h-4 accent-mm-g"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-mm-g truncate">{runner.name}</span>
                {runner.email && <span className="block text-xs text-mm-txw truncate">{runner.email}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
