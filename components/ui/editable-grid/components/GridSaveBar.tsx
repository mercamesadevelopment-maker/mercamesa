'use client';

import React from 'react';
import { Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GridDrafts } from '../hooks/useGridDrafts';

/**
 * La barra de una tabla tipo Excel: cómo se usa, cuántos cambios y errores hay,
 * «Descartar» y «Guardar», y el error del guardado si lo hubo.
 */
export function GridSaveBar({ grid, ayuda }: { grid: GridDrafts; ayuda?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-mm-txs">
          {ayuda ?? 'Escribe sobre la celda o pega desde Excel. Flechas, Tab y Enter para moverte.'}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {grid.changedCount > 0 ? (
            <span className="font-mono text-[11px] uppercase tracking-wider text-tinta">
              {grid.changedCount} {grid.changedCount === 1 ? 'cambio' : 'cambios'}
              {grid.errorCount > 0 && (
                <span className="text-arcilla-oscura">
                  {' '}· {grid.errorCount} {grid.errorCount === 1 ? 'error' : 'errores'}
                </span>
              )}
            </span>
          ) : (
            grid.savedCount !== null && (
              <span className="font-mono text-[11px] uppercase tracking-wider text-salvia">
                {grid.savedCount} guardado{grid.savedCount === 1 ? '' : 's'}
              </span>
            )
          )}
          <Button variant="outline" size="sm" onClick={grid.discard} disabled={grid.changedCount === 0 || grid.saving}>
            <Undo2 className="mr-1 h-4 w-4" /> Descartar
          </Button>
          <Button size="sm" onClick={grid.save} loading={grid.saving} disabled={grid.changedCount === 0 || grid.errorCount > 0}>
            <Save className="mr-1 h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      {grid.saveError && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-rl px-4 py-2 text-sm text-r">
          <span>{grid.saveError}</span>
          <button type="button" onClick={grid.clearSaveError} className="text-xs font-semibold underline">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
