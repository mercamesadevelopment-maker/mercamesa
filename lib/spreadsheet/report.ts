/**
 * Reporte fila por fila de una carga masiva. Compartido por las importaciones
 * del vendedor (productos de tienda) y del admin (catálogo maestro) para que el
 * usuario lea siempre el mismo formato.
 */

export type ImportRowStatus =
  | 'created'
  | 'skipped'
  | 'failed'
  /** Válida, pero la carga se detuvo antes de llegar a ella. */
  | 'not_processed';

export interface ImportRowResult {
  /** Número de fila tal como se ve en Excel (el encabezado es la 1). */
  row: number;
  /** Identificador de la fila: slug del catálogo, código, lo que aplique. */
  code: string;
  /** Nombre legible del producto. */
  name: string;
  status: ImportRowStatus;
  message?: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  notProcessed: number;
}

export interface ImportReport {
  summary: ImportSummary;
  rows: ImportRowResult[];
  /** true cuando solo se validó, sin escribir en la base. */
  dryRun: boolean;
}

export function buildReport(rows: ImportRowResult[], dryRun: boolean): ImportReport {
  const ordered = [...rows].sort((a, b) => a.row - b.row);
  const countOf = (status: ImportRowStatus) =>
    ordered.filter((row) => row.status === status).length;

  return {
    dryRun,
    rows: ordered,
    summary: {
      total: ordered.length,
      created: countOf('created'),
      skipped: countOf('skipped'),
      failed: countOf('failed'),
      notProcessed: countOf('not_processed'),
    },
  };
}
