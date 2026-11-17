'use client';

import React, { useMemo, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { useCategories } from '../hooks/use-categories';
import { useCategoriesGrid } from '../hooks/use-categories-grid';
import { CategoryRow } from '../types/settings.types';
import { EditableGrid } from '@/components/ui/editable-grid/components/EditableGrid';
import type { GridColumn } from '@/components/ui/editable-grid/types';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { useDeleteConfirm } from '@/components/ui/confirm-modal/hooks/use-delete-confirm';
import { Button } from '@/components/ui/button';
import { normalizeText } from '@/lib/utils/text';
import type { CategoryDraft, CategoryField } from '@/lib/categories/batch';

/**
 * Motivo por el que una categoría no se puede borrar, o `null` si sí se puede.
 *
 * El listado ya trae los conteos, así que esto se sabe antes de ofrecer el
 * borrado: el servidor responde lo mismo, pero llegar hasta allá significaba
 * confirmar para que le dijeran que no.
 */
function motivoBloqueo(item: CategoryRow): string | null {
  const productos = item.product_count ?? 0;
  const hijas = item.child_count ?? 0;

  if (productos > 0 && hijas > 0) {
    return `Tiene ${productos} producto(s) y ${hijas} subcategoría(s) asociados.`;
  }
  if (productos > 0) return `Tiene ${productos} producto(s) asociado(s).`;
  if (hijas > 0) return `Tiene ${hijas} subcategoría(s) asociada(s).`;
  return null;
}

/**
 * Las categorías del catálogo, editables como en Excel: se escribe sobre la
 * celda, se pega desde una hoja y se guarda todo junto. El slug no se edita: lo
 * pone el servidor al crear.
 */
export function CategoriesTab() {
  const { categories, loading, error, fetchCategories, deleteCategory } = useCategories();
  const grid = useCategoriesGrid(categories, fetchCategories);
  const [searchTerm, setSearchTerm] = useState('');

  const borrado = useDeleteConfirm<CategoryRow>((item) => deleteCategory(item.id));
  const guardadas = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // El filtro solo oculta: lo editado en las filas ocultas sigue ahí. Las filas
  // nuevas siempre se ven.
  const visibles = useMemo(() => {
    const q = normalizeText(searchTerm.trim());
    if (!q) return grid.drafts;
    return grid.drafts.filter((d) => grid.isNew(d.key) || normalizeText(d.name).includes(q) || (d.slug ?? '').includes(q));
  }, [grid.drafts, searchTerm, grid]);

  // Solo una categoría raíz puede ser madre (dos niveles).
  const opcionesMadre = useMemo(
    () => [
      { value: '', label: 'Ninguna (raíz)' },
      ...grid.drafts
        .filter((d) => !d.parentKey && d.name.trim())
        .map((d) => ({ value: d.key, label: d.name.trim() }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es')),
    ],
    [grid.drafts]
  );

  const columns: GridColumn<CategoryDraft>[] = [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      width: '18rem',
      placeholder: 'Nombre de la categoría',
      hint: (d) => d.slug ?? 'nueva: el slug se crea al guardar',
    },
    { key: 'parentKey', label: 'Categoría padre', type: 'select', width: '14rem', options: opcionesMadre },
    { key: 'description', label: 'Descripción', type: 'text', width: '20rem', placeholder: 'Opcional' },
    { key: 'sortOrder', label: 'Orden', type: 'number', width: '6rem' },
    { key: 'isActive', label: 'Activa', type: 'checkbox', width: '5rem' },
    {
      key: 'uso',
      label: 'En uso',
      type: 'readonly',
      width: '9rem',
      render: (d) => {
        const c = d.id ? guardadas.get(d.id) : undefined;
        if (!c) return <span className="text-xs text-mm-txw italic">Nueva</span>;
        const productos = c.product_count ?? 0;
        const hijas = c.child_count ?? 0;
        if (productos === 0 && hijas === 0) return <span className="text-xs text-mm-txw italic">Sin usar</span>;
        return (
          <span className="flex flex-col text-xs text-mm-txs">
            {productos > 0 && <span>{productos} producto(s)</span>}
            {hijas > 0 && <span>{hijas} subcategoría(s)</span>}
          </span>
        );
      },
    },
  ];

  const accionesDeFila = (d: CategoryDraft) => {
    if (grid.isNew(d.key)) {
      return (
        <button
          type="button"
          onClick={() => grid.removeNewRow(d.key)}
          title="Quitar esta fila nueva"
          className="p-1.5 rounded-full text-mm-txw hover:bg-mm-gbg hover:text-r transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      );
    }

    const c = d.id ? guardadas.get(d.id) : undefined;
    const bloqueo = c ? motivoBloqueo(c) : null;
    // Borrar recarga la tabla y se perderían los cambios sin guardar.
    const motivo = bloqueo
      ? `No se puede eliminar. ${bloqueo} Puedes desactivarla.`
      : grid.changedCount > 0
        ? 'Guarda o descarta los cambios antes de eliminar.'
        : 'Eliminar';

    return (
      <button
        type="button"
        onClick={() => c && borrado.ask(c)}
        disabled={!!bloqueo || grid.changedCount > 0}
        title={motivo}
        className="p-1.5 rounded-full text-mm-txw hover:bg-mm-gbg hover:text-r transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-mm-txw"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    );
  };

  if (loading && categories.length === 0) return <div className="p-8 text-center text-mm-txs">Cargando categorías...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:w-auto max-w-md">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>
        <p className="text-xs text-mm-txw max-w-md">
          Escribe sobre la celda, muévete con las flechas, Tab y Enter, o pega filas copiadas de Excel
          (Nombre · Categoría padre · Descripción · Orden · Activa).
        </p>
      </div>

      <EditableGrid
        rows={visibles}
        columns={columns}
        getRowKey={(d) => d.key}
        getValue={(d, key) => (key === 'uso' ? '' : d[key as CategoryField])}
        onCellChange={(key, col, value) => grid.updateCell(key, col as CategoryField, value)}
        onPaste={(key, col, text) => grid.paste(visibles.map((d) => d.key), key, col as CategoryField, text)}
        isChanged={grid.isChanged}
        errors={grid.errores}
        onAddRow={grid.addRow}
        addRowLabel="Agregar categoría"
        rowActions={accionesDeFila}
        emptyMessage={searchTerm ? 'Ninguna categoría coincide con la búsqueda.' : 'No hay categorías.'}
      />

      {grid.changedCount > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tinta/20 bg-tinta px-5 py-3 text-hueso shadow-lg">
          <span className="text-sm">
            <span className="font-bold">{grid.changedCount}</span> fila(s) con cambios sin guardar
            {grid.errorCount > 0 && (
              <span className="ml-2 rounded-full bg-arcilla px-2 py-0.5 text-xs font-bold text-white">
                {grid.errorCount} por corregir
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-hueso hover:bg-white/10" onClick={grid.discard} disabled={grid.saving}>
              Descartar
            </Button>
            <Button
              size="sm"
              className="bg-lima text-tinta hover:bg-lima/90"
              onClick={grid.save}
              loading={grid.saving}
              disabled={grid.errorCount > 0}
              title={grid.errorCount > 0 ? 'Corrige las celdas en rojo para poder guardar.' : undefined}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!grid.saveError}
        onClose={grid.clearSaveError}
        onConfirm={grid.clearSaveError}
        title="No se guardaron los cambios"
        message={grid.saveError || ''}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />

      <ConfirmModal
        isOpen={!!borrado.target}
        onClose={borrado.cancel}
        onConfirm={borrado.confirm}
        title="Eliminar categoría"
        message={
          <>
            ¿Eliminar <span className="font-bold text-mm-g">{borrado.target?.name}</span>? Esta acción
            no se puede deshacer. Si más adelante la vas a necesitar, desactívala en vez de borrarla.
          </>
        }
        variant="danger"
        confirmText="Eliminar"
        isLoading={borrado.isDeleting}
      />

      <ConfirmModal
        isOpen={!!borrado.error}
        onClose={borrado.dismissError}
        onConfirm={borrado.dismissError}
        title="No se puede eliminar"
        message={borrado.error || ''}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />
    </div>
  );
}
