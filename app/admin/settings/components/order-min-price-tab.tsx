'use client';

import React, { useState } from 'react';
import { Plus, Wallet, User, Clock } from 'lucide-react';
import { useOrderMinPrice } from '../hooks/use-order-min-price';
import { OrderMinPriceHistoryRow } from '../types/settings.types';
import { Table } from '@/components/ui/table/components/Table';
import { useTable } from '@/components/ui/table/hooks/useTable';
import { Button, Input } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { Modal } from '@/components/ui/modal/modal';

export function OrderMinPriceTab() {
  const { history, currentMinPrice, currentAdjustment, loading, error, addAdjustment } = useOrderMinPrice();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ min_price: '', notes: '' });

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: history });

  const handleOpenAdd = () => {
    setFormData({ min_price: currentMinPrice ? String(currentMinPrice) : '', notes: '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setFormError(null);
      await addAdjustment(Number(formData.min_price), formData.notes);
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Fecha',
      sortable: true,
      render: (item: OrderMinPriceHistoryRow) => (
        <span className="text-sm text-mm-txs font-medium">
          {new Date(item.created_at).toLocaleString('es-CO')}
        </span>
      ),
    },
    {
      key: 'min_price',
      label: 'Precio Mínimo',
      sortable: true,
      render: (item: OrderMinPriceHistoryRow) => (
        <span className="font-bold text-mm-g">{fmt(item.min_price)}</span>
      ),
    },
    {
      key: 'notes',
      label: 'Observación',
      render: (item: OrderMinPriceHistoryRow) => (
        <span className="text-sm text-mm-txs">{item.notes || '—'}</span>
      ),
    },
    {
      key: 'changed_by',
      label: 'Registrado por',
      render: (item: OrderMinPriceHistoryRow) => (
        <span className="text-sm text-mm-txs">{item.profiles?.full_name || 'Sistema'}</span>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando precio mínimo de orden...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-mm-gbg/40 border border-mm-crd rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-mm-g text-white rounded-2xl flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-mm-txw">Precio mínimo vigente</p>
            <p className="text-3xl font-fraunces text-mm-g">{fmt(currentMinPrice)}</p>
            {currentAdjustment && (
              <p className="text-xs text-mm-txs mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {currentAdjustment.profiles?.full_name || 'Sistema'}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(currentAdjustment.created_at).toLocaleString('es-CO')}</span>
              </p>
            )}
          </div>
        </div>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo Ajuste
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
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nuevo Ajuste de Precio Mínimo"
        maxWidth="max-w-md"
      >
        <div className="p-8">
          {formError && (
            <div className="p-3 mb-4 text-xs bg-rl/20 text-r border border-r/20 rounded-xl font-bold">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Precio mínimo de orden"
              type="number"
              min="0"
              step="0.01"
              value={formData.min_price}
              onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
              placeholder="Ej: 20000"
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-mm-txs ml-1">Observación del ajuste</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej: Se sube por incremento en costos de envío"
                className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g min-h-[80px]"
                required
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Ajuste'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
