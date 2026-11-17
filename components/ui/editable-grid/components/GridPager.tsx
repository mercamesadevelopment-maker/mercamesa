'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Opciones de «Filas por página». `0` = todas. */
export const ROWS_PER_PAGE_OPTIONS = [20, 50, 100, 200];

interface GridPagerProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange: (n: number) => void;
  /** Total de filas (con los filtros puestos), para el texto «1–20 de 340». */
  total?: number;
  /** Ofrece «Todas» (0). Solo donde las filas ya están en el navegador. */
  allowAll?: boolean;
}

/** Paginación de una tabla tipo Excel: filas por página y anterior/siguiente. */
export function GridPager({ page, totalPages, onPageChange, rowsPerPage, onRowsPerPageChange, total, allowAll }: GridPagerProps) {
  const desde = total === undefined || total === 0 ? 0 : rowsPerPage === 0 ? 1 : (page - 1) * rowsPerPage + 1;
  const hasta = total === undefined ? 0 : rowsPerPage === 0 ? total : Math.min(page * rowsPerPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-mm-txs">
      <label className="flex items-center gap-2">
        Filas por página
        <select
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          className="rounded-lg border border-mm-crd bg-white px-2 py-1 text-tinta"
        >
          {ROWS_PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          {allowAll && <option value={0}>Todas</option>}
        </select>
      </label>
      <div className="flex items-center gap-2">
        {total !== undefined && (
          <span className="font-mono text-xs">
            {desde}–{hasta} de {total}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-mono text-xs">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
