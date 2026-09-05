'use client';

import React, { useState } from 'react';
import { Plus, Percent, User, Clock, RefreshCw } from 'lucide-react';
import { usePricingSettings } from '../hooks/use-pricing-settings';
import { PricingSettingsRow, EnsureSiigoProductResult } from '../types/settings.types';
import { Table } from '@/components/ui/table/components/Table';
import { useTable } from '@/components/ui/table/hooks/useTable';
import { Button, Input, Badge } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import { Modal } from '@/components/ui/modal/modal';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { computeOrderPricing } from '@/lib/pricing/compute-order-pricing';

/** Pedido de ejemplo para la vista previa. Es el mismo caso del Excel del cliente. */
const EXAMPLE_SUBTOTAL = 50000;
const EXAMPLE_DELIVERY = 11161;

const pct = (rate: number) => `${(Number(rate) * 100).toFixed(2).replace('.', ',')}%`;

export function PricingTab() {
  const { history, current, loading, error, addAdjustment, ensureSiigoProducts } = usePricingSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [siigoResult, setSiigoResult] = useState<EnsureSiigoProductResult[] | null>(null);
  const [siigoError, setSiigoError] = useState<string | null>(null);
  const [isEnsuring, setIsEnsuring] = useState(false);
  const [formData, setFormData] = useState({
    service_commission_rate: '',
    message_unit_price: '',
    messages_per_order: '',
    platform_commission_rate: '',
    siigo_delivery_product_code: '',
    siigo_platform_product_code: '',
    notes: '',
  });

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: history });

  const handleOpenAdd = () => {
    // Se parte de las tarifas vigentes: casi siempre se ajusta una sola.
    setFormData({
      service_commission_rate: current ? String(current.service_commission_rate) : '0.0299',
      message_unit_price: current ? String(current.message_unit_price) : '120',
      messages_per_order: current ? String(current.messages_per_order) : '6',
      platform_commission_rate: current ? String(current.platform_commission_rate) : '0.15',
      siigo_delivery_product_code: current?.siigo_delivery_product_code ?? 'DOMICILIO',
      siigo_platform_product_code: current?.siigo_platform_product_code ?? 'SERVICIOMERCAMESA',
      notes: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setFormError(null);
      await addAdjustment({
        service_commission_rate: Number(formData.service_commission_rate),
        message_unit_price: Number(formData.message_unit_price),
        messages_per_order: Number(formData.messages_per_order),
        platform_commission_rate: Number(formData.platform_commission_rate),
        siigo_delivery_product_code: formData.siigo_delivery_product_code,
        siigo_platform_product_code: formData.siigo_platform_product_code,
        notes: formData.notes,
      });
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnsureSiigo = async () => {
    try {
      setIsEnsuring(true);
      setSiigoError(null);
      setSiigoResult(await ensureSiigoProducts());
    } catch (err: unknown) {
      setSiigoError(err instanceof Error ? err.message : 'Error consultando Siigo');
    } finally {
      setIsEnsuring(false);
    }
  };

  // Vista previa en vivo: quien ajuste una tarifa ve de inmediato qué le pasa al
  // total, en vez de tener que hacer la cuenta aparte.
  const preview = computeOrderPricing(EXAMPLE_SUBTOTAL, EXAMPLE_DELIVERY, {
    serviceCommissionRate: Number(isModalOpen ? formData.service_commission_rate : current?.service_commission_rate ?? 0),
    messageUnitPrice: Number(isModalOpen ? formData.message_unit_price : current?.message_unit_price ?? 0),
    messagesPerOrder: Number(isModalOpen ? formData.messages_per_order : current?.messages_per_order ?? 0),
    platformCommissionRate: Number(isModalOpen ? formData.platform_commission_rate : current?.platform_commission_rate ?? 0),
  });

  const previewRows = (
    <div className="space-y-1.5 text-sm">
      <div className="flex justify-between text-mm-txs">
        <span>Productos (los recibe el tendero)</span>
        <span className="font-bold">{fmt(preview.productsSubtotal)}</span>
      </div>
      <div className="flex justify-between text-mm-txw">
        <span>+ comisión de servicio</span>
        <span>{fmt(preview.serviceCommission)}</span>
      </div>
      <div className="flex justify-between text-mm-txw">
        <span>+ mensajes</span>
        <span>{fmt(preview.messagesAmount)}</span>
      </div>
      <div className="flex justify-between text-mm-txs pt-1.5 border-t border-mm-crd/50">
        <span className="font-bold">= Valor neto de compra</span>
        <span className="font-bold">{fmt(preview.netPurchase)}</span>
      </div>
      <div className="flex justify-between text-mm-txw">
        <span>+ servicio MercaMesa</span>
        <span>{fmt(preview.platformCommission)}</span>
      </div>
      <div className="flex justify-between text-mm-txw">
        <span>+ domicilio (ejemplo)</span>
        <span>{fmt(preview.deliveryFee)}</span>
      </div>
      <div className="flex justify-between pt-1.5 border-t border-mm-crd/50">
        <span className="font-bold text-mm-g">Total a pagar</span>
        <span className="font-bold text-mm-g">{fmt(preview.total)}</span>
      </div>
    </div>
  );

  const columns = [
    {
      key: 'created_at',
      label: 'Fecha',
      sortable: true,
      render: (item: PricingSettingsRow) => (
        <span className="text-sm text-mm-txs font-medium">
          {new Date(item.created_at).toLocaleString('es-CO')}
        </span>
      ),
    },
    {
      key: 'service_commission_rate',
      label: 'Comisión servicio',
      sortable: true,
      render: (item: PricingSettingsRow) => (
        <span className="font-bold text-mm-g">{pct(item.service_commission_rate)}</span>
      ),
    },
    {
      key: 'platform_commission_rate',
      label: 'Servicio MercaMesa',
      sortable: true,
      render: (item: PricingSettingsRow) => (
        <span className="font-bold text-mm-g">{pct(item.platform_commission_rate)}</span>
      ),
    },
    {
      key: 'message_unit_price',
      label: 'Mensajes',
      render: (item: PricingSettingsRow) => (
        <span className="text-sm text-mm-txs">
          {item.messages_per_order} × {fmt(item.message_unit_price)}
        </span>
      ),
    },
    {
      key: 'notes',
      label: 'Observación',
      render: (item: PricingSettingsRow) => (
        <span className="text-sm text-mm-txs">{item.notes || '—'}</span>
      ),
    },
    {
      key: 'changed_by',
      label: 'Registrado por',
      render: (item: PricingSettingsRow) => (
        <span className="text-sm text-mm-txs">{item.profiles?.full_name || 'Sistema'}</span>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando tarifas...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="bg-mm-gbg/40 border border-mm-crd rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-mm-g text-white rounded-2xl flex items-center justify-center shrink-0">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-mm-txw">Tarifas vigentes</p>
              <p className="text-3xl font-fraunces text-mm-g">
                {current ? `${pct(current.service_commission_rate)} + ${pct(current.platform_commission_rate)}` : 'Sin configurar'}
              </p>
              {current && (
                <p className="text-xs text-mm-txs mt-1 flex flex-wrap items-center gap-3">
                  <span>{current.messages_per_order} mensajes × {fmt(current.message_unit_price)}</span>
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {current.profiles?.full_name || 'Sistema'}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(current.created_at).toLocaleString('es-CO')}</span>
                </p>
              )}
            </div>
          </div>
          <Button size="sm" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo Ajuste
          </Button>
        </div>

        {current && (
          <div className="grid md:grid-cols-2 gap-5 pt-5 border-t border-mm-crd/50">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-mm-txw mb-3">
                Ejemplo con {fmt(EXAMPLE_SUBTOTAL)} en productos
              </p>
              {previewRows}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-mm-txw mb-3">
                Facturación en Siigo
              </p>
              <div className="space-y-2 text-sm text-mm-txs">
                <div className="flex justify-between gap-3">
                  <span>Domicilio</span>
                  <code className="text-xs bg-white px-2 py-0.5 rounded-lg border border-mm-crd">{current.siigo_delivery_product_code}</code>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Servicio MercaMesa</span>
                  <code className="text-xs bg-white px-2 py-0.5 rounded-lg border border-mm-crd">{current.siigo_platform_product_code}</code>
                </div>
              </div>
              <p className="text-xs text-mm-txw mt-3 leading-relaxed">
                Estos productos deben existir en Siigo; si no, no se puede emitir ninguna factura.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={handleEnsureSiigo} disabled={isEnsuring}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isEnsuring ? 'animate-spin' : ''}`} />
                {isEnsuring ? 'Verificando...' : 'Crear / verificar en Siigo'}
              </Button>

              {siigoResult && (
                <div className="mt-3 space-y-1.5">
                  {siigoResult.map((r) => (
                    <div key={r.code} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-mm-txs">{r.name}</span>
                      <Badge variant={r.status === 'error' ? 'error' : 'success'}>
                        {r.status === 'created' ? 'Creado' : r.status === 'already_exists' ? 'Ya existía' : 'Error'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
        title="Nuevo Ajuste de Tarifas"
        maxWidth="max-w-2xl"
      >
        <div className="p-8">
          {formError && (
            <div className="p-3 mb-4 text-xs bg-rl/20 text-r border border-r/20 rounded-xl font-bold">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Comisión de servicio (0,0299 = 2,99%)"
                type="number" min="0" max="1" step="0.0001"
                value={formData.service_commission_rate}
                onChange={(e) => setFormData({ ...formData, service_commission_rate: e.target.value })}
                required
              />
              <Input
                label="Servicio MercaMesa (0,15 = 15%)"
                type="number" min="0" max="1" step="0.0001"
                value={formData.platform_commission_rate}
                onChange={(e) => setFormData({ ...formData, platform_commission_rate: e.target.value })}
                required
              />
              <Input
                label="Mensajes por pedido"
                type="number" min="0" step="1"
                value={formData.messages_per_order}
                onChange={(e) => setFormData({ ...formData, messages_per_order: e.target.value })}
                required
              />
              <Input
                label="Valor por mensaje"
                type="number" min="0" step="0.01"
                value={formData.message_unit_price}
                onChange={(e) => setFormData({ ...formData, message_unit_price: e.target.value })}
                required
              />
              <Input
                label="Código en Siigo del domicilio"
                value={formData.siigo_delivery_product_code}
                onChange={(e) => setFormData({ ...formData, siigo_delivery_product_code: e.target.value })}
                required
              />
              <Input
                label="Código en Siigo del servicio"
                value={formData.siigo_platform_product_code}
                onChange={(e) => setFormData({ ...formData, siigo_platform_product_code: e.target.value })}
                required
              />
            </div>

            <div className="bg-mm-gbg/40 border border-mm-crd rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-mm-txw mb-3">
                Así quedaría un pedido de {fmt(EXAMPLE_SUBTOTAL)}
              </p>
              {previewRows}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-mm-txs ml-1">Observación del ajuste</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej: Se ajusta la comisión de plataforma por acuerdo con el cliente"
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

      <ConfirmModal
        isOpen={!!siigoError}
        onClose={() => setSiigoError(null)}
        onConfirm={() => setSiigoError(null)}
        title="No se pudo verificar en Siigo"
        message={siigoError ?? ''}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />
    </div>
  );
}
