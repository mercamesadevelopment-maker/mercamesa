import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import type { GridCellType, GridPosition, GridValue } from '../types';

type Move = 'down' | 'up' | 'right' | 'left' | null;

interface Options {
  rowCount: number;
  columnTypes: GridCellType[];
  getValue: (pos: GridPosition) => GridValue;
  commit: (pos: GridPosition, value: GridValue) => void;
}

/**
 * La celda activa y el teclado, como en una hoja de cálculo.
 *
 * Seleccionada (sin editar):
 * - flechas, Tab y Shift+Tab para moverse;
 * - Enter o F2 para editar; escribir una letra empieza a editar con esa letra;
 * - Supr o Retroceso vacían el texto; Espacio cambia una casilla.
 *
 * Editando:
 * - Enter guarda y baja; Tab guarda y pasa a la derecha;
 * - Escape deshace lo escrito.
 */
export function useGridNavigation({ rowCount, columnTypes, getValue, commit }: Options) {
  const [active, setActive] = useState<GridPosition | null>(null);
  const [editing, setEditingState] = useState<{ value: string } | null>(null);
  // Si hay una edición abierta, sin esperar al render: Enter guarda y el campo
  // desaparece, y su `blur` llega después con valores viejos. Sin esto, ese
  // segundo cierre devolvía la celda activa a donde estaba.
  const editandoRef = useRef(false);
  const setEditing = useCallback((value: { value: string } | null) => {
    editandoRef.current = value !== null;
    setEditingState(value);
  }, []);

  const colCount = columnTypes.length;

  const moveFrom = useCallback(
    (pos: GridPosition, move: Move): GridPosition => {
      if (move === 'down') return { row: Math.min(rowCount - 1, pos.row + 1), col: pos.col };
      if (move === 'up') return { row: Math.max(0, pos.row - 1), col: pos.col };
      if (move === 'right') {
        if (pos.col < colCount - 1) return { row: pos.row, col: pos.col + 1 };
        return pos.row < rowCount - 1 ? { row: pos.row + 1, col: 0 } : pos;
      }
      if (move === 'left') {
        if (pos.col > 0) return { row: pos.row, col: pos.col - 1 };
        return pos.row > 0 ? { row: pos.row - 1, col: colCount - 1 } : pos;
      }
      return pos;
    },
    [rowCount, colCount]
  );

  const select = useCallback(
    (pos: GridPosition) => {
      setEditing(null);
      setActive(pos);
    },
    [setEditing]
  );

  const isEditable = (pos: GridPosition) => {
    const t = columnTypes[pos.col];
    return t === 'text' || t === 'number' || t === 'select';
  };

  const startEdit = (initial?: string) => {
    if (!active || !isEditable(active)) return;
    setEditing({ value: initial ?? String(getValue(active) ?? '') });
  };

  /** Guarda lo escrito (si cambió) y se mueve. */
  const finishEdit = (move: Move, value?: string) => {
    if (!active || !editandoRef.current) return;
    const nuevo = value ?? editing?.value;
    if (nuevo !== undefined && nuevo !== String(getValue(active) ?? '')) commit(active, nuevo);
    setEditing(null);
    setActive(moveFrom(active, move));
  };

  const cancelEdit = () => setEditing(null);

  /** Teclas con la celda seleccionada (el foco está en la tabla). */
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (!active || editing) return;
    const tipo = columnTypes[active.col];
    const mover = (m: Move) => {
      e.preventDefault();
      setActive(moveFrom(active, m));
    };

    switch (e.key) {
      case 'ArrowDown': return mover('down');
      case 'ArrowUp': return mover('up');
      case 'ArrowRight': return mover('right');
      case 'ArrowLeft': return mover('left');
      case 'Tab': return mover(e.shiftKey ? 'left' : 'right');
      case 'Enter':
      case 'F2':
        e.preventDefault();
        return startEdit();
      case ' ':
        if (tipo === 'checkbox') {
          e.preventDefault();
          commit(active, !getValue(active));
        }
        return;
      case 'Delete':
      case 'Backspace':
        if (tipo === 'text' || tipo === 'number') {
          e.preventDefault();
          commit(active, '');
        }
        return;
    }

    // Escribir sobre una celda seleccionada la reemplaza, como en Excel.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && (tipo === 'text' || tipo === 'number')) {
      e.preventDefault();
      startEdit(e.key);
    }
  };

  /** Teclas dentro del campo que se está editando. */
  const onEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEdit(e.shiftKey ? 'up' : 'down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finishEdit(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return {
    active,
    editing,
    select,
    startEdit,
    setEditValue: (value: string) => setEditing({ value }),
    finishEdit,
    cancelEdit,
    onGridKeyDown,
    onEditorKeyDown,
  };
}
