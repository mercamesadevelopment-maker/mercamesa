import React from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { Product } from '@/src/types';

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  newOffer: {
    title: string;
    desc: string;
    type: 'percentage' | 'fixed';
    value: number;
    productIds: (number | string)[];
    emoji: string;
    endDate: string;
  };
  setNewOffer: React.Dispatch<React.SetStateAction<{
    title: string;
    desc: string;
    type: 'percentage' | 'fixed';
    value: number;
    productIds: (number | string)[];
    emoji: string;
    endDate: string;
  }>>;
  onSubmit: (e: React.FormEvent) => void;
}

export function OfferModal({
  isOpen,
  onClose,
  products,
  newOffer,
  setNewOffer,
  onSubmit,
}: OfferModalProps) {
  const toggleProductSelect = (productId: number | string) => {
    setNewOffer(prev => {
      const idx = prev.productIds.indexOf(productId);
      if (idx > -1) {
        return { ...prev, productIds: prev.productIds.filter(id => id !== productId) };
      } else {
        return { ...prev, productIds: [...prev.productIds, productId] };
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nueva Oferta">
      <form onSubmit={onSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Título de la Oferta" 
            value={newOffer.title}
            onChange={e => setNewOffer(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Ej: Festival del Tomate"
            required
          />
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-mm-txs ml-1">Emoji / Icono</label>
            <select
              value={newOffer.emoji}
              onChange={e => setNewOffer(prev => ({ ...prev, emoji: e.target.value }))}
              className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none text-sm transition-all"
            >
              <option value="🏷️">🏷️ Oferta</option>
              <option value="🍅">🍅 Tomate</option>
              <option value="🥩">🥩 Carne</option>
              <option value="🍌">🍌 Banano</option>
              <option value="🥛">🥛 Lácteos</option>
              <option value="🍞">🍞 Panadería</option>
              <option value="🥕">🥕 Zanahoria</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-sm font-medium text-mm-txs ml-1">Descripción</label>
          <textarea
            value={newOffer.desc}
            onChange={e => setNewOffer(prev => ({ ...prev, desc: e.target.value }))}
            placeholder="Escribe el detalle de la oferta..."
            className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none text-sm min-h-[80px] transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-mm-txs ml-1">Tipo de Descuento</label>
            <select
              value={newOffer.type}
              onChange={e => setNewOffer(prev => ({ ...prev, type: e.target.value as 'percentage' | 'fixed' }))}
              className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none text-sm transition-all"
            >
              <option value="percentage">Porcentaje (%)</option>
              <option value="fixed">Precio Fijo Especial ($)</option>
            </select>
          </div>
          <Input 
            label={newOffer.type === 'percentage' ? "Porcentaje de Descuento (%)" : "Descuento Fijo ($)"}
            type="number"
            value={newOffer.value || ''}
            onChange={e => setNewOffer(prev => ({ ...prev, value: Number(e.target.value) }))}
            placeholder="0"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Input 
            label="Fecha Límite" 
            type="date"
            value={newOffer.endDate}
            onChange={e => setNewOffer(prev => ({ ...prev, endDate: e.target.value }))}
            required
          />
        </div>

        {/* Product Selection checkboxes */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-mm-txs ml-1">Seleccionar Productos aplicables</label>
          <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto p-2 border border-mm-crd rounded-2xl bg-mm-gbg/5">
            {products.map(p => (
              <label 
                key={p.id}
                className="flex items-center gap-3 p-2 bg-white rounded-xl border border-mm-crd/50 hover:bg-mm-gbg/10 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={newOffer.productIds.includes(p.id)}
                  onChange={() => toggleProductSelect(p.id)}
                  className="rounded text-mm-g focus:ring-mm-g/20"
                />
                <span className="text-xs font-bold text-mm-g">{p.emoji} {p.name}</span>
              </label>
            ))}
            {products.length === 0 && (
              <p className="text-xs text-mm-txw italic p-2 col-span-2 text-center">No hay productos en tu inventario.</p>
            )}
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-mm-gbg">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1">
            Crear Oferta
          </Button>
        </div>
      </form>
    </Modal>
  );
}
