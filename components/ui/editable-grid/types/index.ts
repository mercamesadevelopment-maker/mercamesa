import type React from 'react';

/** Cómo se edita una columna. `readonly` solo muestra (`render`). */
export type GridCellType = 'text' | 'number' | 'select' | 'checkbox' | 'readonly';

export type GridValue = string | boolean;

export interface GridColumn<TRow> {
  key: string;
  label: string;
  type: GridCellType;
  /** Ancho de la columna (CSS), p. ej. `'16rem'`. */
  width?: string;
  /** Las opciones de un `select`. */
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Lo que muestra una columna `readonly`. */
  render?: (row: TRow) => React.ReactNode;
  /** Texto pequeño debajo del valor (p. ej. el slug). */
  hint?: (row: TRow) => React.ReactNode;
  /** El encabezado ordena (avisa con `onSort`; ordenar es de quien usa la tabla). */
  sortable?: boolean;
}

/** Errores por fila y columna: el mensaje se muestra en la celda. */
export type GridErrors = Record<string, Partial<Record<string, string>>>;

export interface EditableGridProps<TRow> {
  rows: TRow[];
  columns: GridColumn<TRow>[];
  getRowKey: (row: TRow) => string;
  getValue: (row: TRow, columnKey: string) => GridValue;
  onCellChange: (rowKey: string, columnKey: string, value: GridValue) => void;
  /**
   * Lo pegado con Ctrl+V sobre una celda, tal cual (filas por salto de línea,
   * celdas por tabulador). Quien usa la tabla decide cómo repartirlo.
   */
  onPaste?: (rowKey: string, columnKey: string, text: string) => void;
  /** Si la celda difiere de lo guardado: se resalta. */
  isChanged?: (rowKey: string, columnKey: string) => boolean;
  errors?: GridErrors;
  onAddRow?: () => void;
  addRowLabel?: string;
  /** Botones al final de cada fila (borrar, etc.). */
  rowActions?: (row: TRow) => React.ReactNode;
  emptyMessage?: string;
  /** Alto máximo del área con scroll. Default: `'65vh'`. */
  maxHeight?: string;
  /** Por qué columna está ordenada, para pintar la flecha. Igual que en `Table`. */
  sortKey?: string | null;
  sortOrder?: 'asc' | 'desc';
  /** Clic en el encabezado de una columna `sortable`. */
  onSort?: (columnKey: string) => void;
}

/** La celda activa: fila y columna por posición. */
export interface GridPosition {
  row: number;
  col: number;
}
