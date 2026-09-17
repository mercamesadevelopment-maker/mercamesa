'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, X, Scale } from 'lucide-react';
import { useMeasurementUnits } from '../hooks/use-measurement-units';
import { MeasurementUnitRow } from '../types/settings.types';
import { Table } from '@/components/ui/table/components/Table';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { useDeleteConfirm } from '@/components/ui/confirm-modal/hooks/use-delete-confirm';
import { useTable } from '@/components/ui/table/hooks/useTable';
import { Button, Badge, Input } from '@/src/components/Shared';
import { motion, AnimatePresence } from 'motion/react';

/** Motivo por el que la unidad no se puede borrar, o `null` si sí se puede. */
function motivoBloqueo(item: MeasurementUnitRow): string | null {
  const catalogo = item.catalog_product_count ?? 0;
  const tienda = item.store_product_count ?? 0;

  if (catalogo > 0 && tienda > 0) {
    return `La usan ${catalogo} producto(s) del catálogo y ${tienda} de tienda.`;
  }
  if (catalogo > 0) return `La usan ${catalogo} producto(s) del catálogo.`;
  if (tienda > 0) return `La usan ${tienda} producto(s) de tienda.`;
  return null;
}

export function MeasurementUnitsTab() {
  const { units, loading, error, saveUnit, deleteUnit } = useMeasurementUnits();
  const borrado = useDeleteConfirm<MeasurementUnitRow>((item) => deleteUnit(item.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<MeasurementUnitRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    is_active: true,
  });

  const filteredUnits = useMemo(() => {
    return units.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [units, searchTerm]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: filteredUnits });

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setFormData({
      name: '',
      abbreviation: '',
      is_active: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MeasurementUnitRow) => {
    setEditingUnit(item);
    setFormData({
      name: item.name,
      abbreviation: item.abbreviation,
      is_active: item.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setFormError(null);
      await saveUnit(editingUnit ? editingUnit.id : null, {
        name: formData.name,
        abbreviation: formData.abbreviation,
        is_active: formData.is_active,
      });
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Nombre de Unidad',
      sortable: true,
      render: (item: MeasurementUnitRow) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-mm-gbg rounded-lg flex items-center justify-center text-mm-g font-bold shrink-0">
            <Scale className="w-5 h-5 text-mm-g" />
          </div>
          <span className="font-bold text-mm-g">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'abbreviation',
      label: 'Abreviatura',
      sortable: true,
      render: (item: MeasurementUnitRow) => (
        <Badge variant="oro" className="font-mono text-xs">
          {item.abbreviation}
        </Badge>
      ),
    },
    {
      key: 'catalog_product_count',
      label: 'En uso',
      sortable: true,
      render: (item: MeasurementUnitRow) => {
        const catalogo = item.catalog_product_count ?? 0;
        const tienda = item.store_product_count ?? 0;

        if (catalogo === 0 && tienda === 0) {
          return <span className="text-xs text-mm-txw italic">Sin usar</span>;
        }

        return (
          <div className="flex flex-col gap-0.5 text-xs text-mm-txs">
            {catalogo > 0 && <span>{catalogo} del catálogo</span>}
            {tienda > 0 && <span>{tienda} de tienda</span>}
          </div>
        );
      },
    },
    {
      key: 'is_active',
      label: 'Estado',
      sortable: true,
      render: (item: MeasurementUnitRow) => (
        <Badge variant={item.is_active ? 'success' : 'warning'}>
          {item.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando unidades de medida...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full sm:w-auto max-w-md">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o abreviatura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Unidad
        </Button>
      </div>

      <Table
        data={paginatedData}
        columns={columns}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={handleSort}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={setRowsPerPage}
        actions={(item: MeasurementUnitRow) => {
          const bloqueo = motivoBloqueo(item);

          return (
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenEdit(item)}
                className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => borrado.ask(item)}
                disabled={!!bloqueo}
                title={bloqueo ? `No se puede eliminar. ${bloqueo} Puedes desactivarla.` : 'Eliminar'}
                className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-mm-txw"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        }}
      />

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl overflow-hidden max-w-md w-full p-8 z-10"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors text-mm-txs"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-fraunces text-mm-g mb-6">
                {editingUnit ? 'Editar Unidad de Medida' : 'Nueva Unidad de Medida'}
              </h3>

              {formError && (
                <div className="p-3 mb-4 text-xs bg-rl/20 text-r border border-r/20 rounded-xl font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Nombre completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Kilogramo"
                  required
                />

                <Input
                  label="Abreviatura"
                  value={formData.abbreviation}
                  onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                  placeholder="Ej: kg"
                  required
                />

                <label className="flex items-center gap-3 cursor-pointer py-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-mm-g rounded cursor-pointer"
                  />
                  <span className="text-sm font-bold text-mm-g">Unidad Activa</span>
                </label>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!borrado.target}
        onClose={borrado.cancel}
        onConfirm={borrado.confirm}
        title="Eliminar unidad de medida"
        message={
          <>
            ¿Eliminar <span className="font-bold text-mm-g">{borrado.target?.name}</span>? Esta acción
            no se puede deshacer. Si la vas a necesitar más adelante, desactívala en vez de borrarla.
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
