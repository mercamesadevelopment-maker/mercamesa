'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { IVA_RATES, ivaLabel } from '@/lib/pricing/iva';
import { useBulkIva } from '../hooks/useBulkIva';

interface BulkIvaActionProps {
  selectedIds: string[];
  /** Después de aplicar: quitar la selección y recargar el listado. */
  onApplied: () => void;
}

/**
 * «Cambiar IVA» para los productos seleccionados. Es lo que se usa si una
 * reforma grava productos que ya están en el catálogo: la carga masiva solo
 * crea productos nuevos.
 */
export function BulkIvaAction({ selectedIds, onApplied }: BulkIvaActionProps) {
  const bulk = useBulkIva(onApplied);
  const cuantos = selectedIds.length;

  return (
    <>
      <select
        value={String(bulk.ivaRate)}
        onChange={(e) => bulk.setIvaRate(Number(e.target.value))}
        aria-label="Tarifa de IVA"
        className="px-4 py-2 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g cursor-pointer"
      >
        {IVA_RATES.map((rate) => (
          <option key={rate} value={String(rate)}>IVA {ivaLabel(rate)}</option>
        ))}
      </select>
      <Button size="sm" variant="outline" onClick={() => bulk.setConfirmOpen(true)} disabled={bulk.applying}>
        {bulk.applying ? 'Aplicando...' : 'Cambiar IVA'}
      </Button>

      <ConfirmModal
        isOpen={bulk.confirmOpen}
        onClose={() => bulk.setConfirmOpen(false)}
        onConfirm={() => bulk.apply(selectedIds)}
        title="Cambiar el IVA"
        message={
          `${cuantos} producto(s) quedarán con IVA del ${ivaLabel(bulk.ivaRate)}, incluido en el precio de cada tienda. ` +
          'Los pedidos ya hechos no cambian.' +
          (bulk.ivaRate > 0 ? ' Hoy la factura no discrimina IVA: confírmalo antes con contabilidad.' : '')
        }
        variant={bulk.ivaRate > 0 ? 'warning' : 'info'}
        confirmText="Cambiar"
        isLoading={bulk.applying}
      />

      <ConfirmModal
        isOpen={!!bulk.error}
        onClose={bulk.clearError}
        onConfirm={bulk.clearError}
        title="No se pudo cambiar el IVA"
        message={bulk.error || ''}
        variant="danger"
        confirmText="Entendido"
        hideCancel
      />
    </>
  );
}
