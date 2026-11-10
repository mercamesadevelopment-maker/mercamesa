'use client';

import React, { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useGridNavigation } from '../hooks/useGridNavigation';
import type { EditableGridProps, GridColumn, GridPosition, GridValue } from '../types';

/**
 * Tabla que se edita como una hoja de cálculo: se escribe sobre la celda, se
 * navega con el teclado y se pega desde Excel.
 *
 * No sabe de qué son las filas: muestra valores, avisa cada cambio
 * (`onCellChange`) y entrega lo pegado (`onPaste`). Validar, guardar y repartir
 * lo pegado es de quien la usa.
 */
export function EditableGrid<TRow>({
  rows,
  columns,
  getRowKey,
  getValue,
  onCellChange,
  onPaste,
  isChanged,
  errors,
  onAddRow,
  addRowLabel = 'Agregar fila',
  rowActions,
  emptyMessage = 'No hay filas.',
  maxHeight = '65vh',
}: EditableGridProps<TRow>) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  const valorEn = (pos: GridPosition): GridValue => {
    const row = rows[pos.row];
    return row ? getValue(row, columns[pos.col].key) : '';
  };

  const nav = useGridNavigation({
    rowCount: rows.length,
    columnTypes: columns.map((c) => c.type),
    getValue: valorEn,
    commit: (pos, value) => {
      const row = rows[pos.row];
      if (row) onCellChange(getRowKey(row), columns[pos.col].key, value);
    },
  });

  // Si el filtro deja menos filas, la celda activa no puede quedar afuera.
  const active = nav.active && nav.active.row < rows.length ? nav.active : null;

  // La celda activa siempre a la vista.
  useEffect(() => {
    if (!active) return;
    contenedorRef.current
      ?.querySelector(`[data-cell="${active.row}-${active.col}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active?.row, active?.col]);

  // Al terminar de editar, el foco vuelve a la tabla para seguir con el teclado.
  const editandoAntes = useRef(false);
  useEffect(() => {
    if (editandoAntes.current && !nav.editing) contenedorRef.current?.focus({ preventScroll: true });
    editandoAntes.current = Boolean(nav.editing);
  }, [nav.editing]);

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!active || !onPaste) return;
    const texto = e.clipboardData.getData('text/plain');
    // Una sola celda mientras se edita: que la pegue el campo, como siempre.
    if (nav.editing && !/[\t\n]/.test(texto.trim())) return;
    e.preventDefault();
    nav.cancelEdit();
    onPaste(getRowKey(rows[active.row]), columns[active.col].key, texto);
  };

  return (
    <div className="rounded-2xl border border-mm-crd bg-white overflow-hidden">
      <div
        ref={contenedorRef}
        tabIndex={0}
        onKeyDown={nav.onGridKeyDown}
        onPaste={handlePaste}
        className="overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-tinta/30 custom-scrollbar"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-hueso">
            <tr>
              <th className="w-10 border-b border-mm-crd px-2 py-2 text-[10px] font-mono text-mm-txw">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className="border-b border-l border-mm-crd px-3 py-2 text-left text-[11px] font-mono uppercase tracking-wider text-mm-txs"
                >
                  {col.label}
                </th>
              ))}
              {rowActions && <th className="w-16 border-b border-l border-mm-crd" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-10 text-center text-mm-txw italic">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row, r) => {
              const rowKey = getRowKey(row);
              return (
                <tr key={rowKey} className="group">
                  <td className="border-b border-mm-gbg px-2 text-center text-[10px] font-mono text-mm-txw">{r + 1}</td>
                  {columns.map((col, c) => (
                    <Celda
                      key={col.key}
                      row={row}
                      col={col}
                      pos={{ row: r, col: c }}
                      value={getValue(row, col.key)}
                      activa={active?.row === r && active?.col === c}
                      editando={active?.row === r && active?.col === c ? nav.editing : null}
                      cambiada={isChanged?.(rowKey, col.key) ?? false}
                      error={errors?.[rowKey]?.[col.key]}
                      nav={nav}
                      onToggle={(v) => onCellChange(rowKey, col.key, v)}
                    />
                  ))}
                  {rowActions && (
                    <td className="border-b border-l border-mm-gbg px-2 text-center">{rowActions(row)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {onAddRow && (
        <button
          type="button"
          onClick={onAddRow}
          className="flex w-full items-center gap-2 border-t border-mm-crd px-4 py-2.5 text-sm font-medium text-mm-txs transition-colors hover:bg-lima-clara/50 hover:text-tinta"
        >
          <Plus className="h-4 w-4" /> {addRowLabel}
        </button>
      )}
    </div>
  );
}

interface CeldaProps<TRow> {
  row: TRow;
  col: GridColumn<TRow>;
  pos: GridPosition;
  value: GridValue;
  activa: boolean;
  editando: { value: string } | null;
  cambiada: boolean;
  error?: string;
  nav: ReturnType<typeof useGridNavigation>;
  onToggle: (value: boolean) => void;
}

function Celda<TRow>({ row, col, pos, value, activa, editando, cambiada, error, nav, onToggle }: CeldaProps<TRow>) {
  const etiqueta =
    col.type === 'select' ? col.options?.find((o) => o.value === value)?.label ?? '' : String(value ?? '');

  let contenido: React.ReactNode;

  if (col.type === 'readonly') {
    contenido = col.render?.(row);
  } else if (col.type === 'checkbox') {
    contenido = (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onToggle(e.target.checked)}
        tabIndex={-1}
        className="h-4 w-4 accent-tinta cursor-pointer"
      />
    );
  } else if (editando && col.type === 'select') {
    contenido = (
      <select
        autoFocus
        value={editando.value}
        onChange={(e) => nav.finishEdit(null, e.target.value)}
        onKeyDown={nav.onEditorKeyDown}
        onBlur={() => nav.cancelEdit()}
        className="w-full bg-white text-sm text-tinta outline-none"
      >
        {col.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else if (editando) {
    contenido = (
      <input
        autoFocus
        inputMode={col.type === 'number' ? 'numeric' : undefined}
        value={editando.value}
        onChange={(e) => nav.setEditValue(e.target.value)}
        onKeyDown={nav.onEditorKeyDown}
        onBlur={() => nav.finishEdit(null)}
        className="w-full bg-white text-sm text-tinta outline-none"
      />
    );
  } else {
    contenido = etiqueta ? (
      <span className="block truncate text-tinta">{etiqueta}</span>
    ) : (
      <span className="block truncate text-mm-txw italic">{col.placeholder ?? ''}</span>
    );
  }

  return (
    <td
      data-cell={`${pos.row}-${pos.col}`}
      title={error}
      onClick={() => {
        if (!activa) nav.select(pos);
      }}
      onDoubleClick={() => nav.startEdit()}
      className={cn(
        'relative h-10 border-b border-l border-mm-gbg px-3 align-middle',
        col.type === 'checkbox' && 'text-center',
        col.type !== 'readonly' && 'cursor-cell',
        cambiada && 'bg-lima-clara/60',
        error && 'bg-rl/70',
        activa && 'ring-2 ring-inset ring-tinta',
        editando && 'bg-white'
      )}
      style={{ maxWidth: col.width }}
    >
      {contenido}
      {col.hint && !editando && <span className="block truncate text-[10px] font-mono text-mm-txw">{col.hint(row)}</span>}
      {error && activa && !editando && (
        <span className="absolute left-0 top-full z-20 mt-0.5 w-max max-w-xs rounded-lg bg-r px-2 py-1 text-[11px] text-white shadow">
          {error}
        </span>
      )}
    </td>
  );
}
