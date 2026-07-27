import React from 'react';
import { motion } from 'motion/react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input, Badge } from '@/src/components/Shared';
import { MasterProduct, Product } from '@/src/types';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  catalog: MasterProduct[];
  units: { id: string; name: string; abbreviation: string }[];
  newProduct: {
    name: string;
    retailPrice: number;
    stock: number;
    unit: string;
    unitId: string;
    isFeatured: boolean;
    emoji: string;
    cat: string;
    image: string;
    masterId: any;
    wholesalePrice: number;
    wholesaleMinQty: number;
    minOrderQty: number;
  };
  setNewOfferProduct: React.Dispatch<React.SetStateAction<{
    name: string;
    retailPrice: number;
    stock: number;
    unit: string;
    unitId: string;
    isFeatured: boolean;
    emoji: string;
    cat: string;
    image: string;
    masterId: any;
    wholesalePrice: number;
    wholesaleMinQty: number;
    minOrderQty: number;
  }>>;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProductModal({
  isOpen,
  onClose,
  editingProduct,
  catalog,
  units,
  newProduct,
  setNewOfferProduct,
  onSubmit,
}: ProductModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editingProduct ? 'Editar Producto' : 'Gestión de Inventario'}
    >
      <form onSubmit={onSubmit} className="p-10 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-mm-txs ml-1">Imagen del Producto</label>
          <div className="flex gap-4">
            <div className="w-24 h-24 bg-mm-gbg/10 rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border border-mm-crd relative">
              {newProduct.image ? (
                <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">{newProduct.emoji || '📦'}</span>
              )}
            </div>
            <div className="flex-grow flex flex-col justify-center">
              <p className="text-xs text-mm-txs leading-tight font-medium">La imagen y categoría se asignan automáticamente según el producto del catálogo oficial.</p>
            </div>
          </div>
        </div>

        <SearchableSelect
          label="Nombre del Producto"
          required
          disabled={!!editingProduct}
          value={newProduct.masterId}
          onChange={(mid) => {
            const master = catalog.find(i => String(i.id) === String(mid));
            if (master) {
              setNewOfferProduct(prev => ({
                ...prev,
                masterId: mid,
                name: master.name,
                cat: master.cat,
                image: master.image || '',
                unit: master.defaultUnit,
                unitId: master.defaultUnitId || '',
                emoji: master.emoji
              }));
            }
          }}
          placeholder="Seleccione un producto..."
          options={catalog.map((item) => ({
            value: String(item.id),
            label: item.name,
            group: item.cat,
            emoji: item.emoji,
          }))}
        />

        {newProduct.name && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 p-4 bg-mm-gbg/20 rounded-2xl border border-mm-crd"
          >
            <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-3xl overflow-hidden border border-mm-crd">
              {newProduct.image ? (
                <img src={newProduct.image} alt={newProduct.name} className="w-full h-full object-cover" />
              ) : (
                catalog.find(i => i.id === newProduct.masterId)?.emoji || '📦'
              )}
            </div>
            <div>
              <p className="font-bold text-mm-g">{newProduct.name}</p>
              <p className="text-xs text-mm-txs">{newProduct.cat}</p>
              <Badge variant="default" className="mt-1">{newProduct.unit}</Badge>
            </div>
          </motion.div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-mm-txs ml-1">Unidad</label>
            <select
              value={newProduct.unitId}
              onChange={e => {
                const unitId = e.target.value;
                const selected = units.find(u => u.id === unitId);
                setNewOfferProduct(prev => ({
                  ...prev,
                  unitId,
                  unit: selected?.abbreviation || prev.unit,
                }));
              }}
              className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
              required
            >
              <option value="">Selecciona una unidad</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-mm-txs ml-1">Categoría</label>
            <div className="px-4 py-3 bg-mm-gbg/10 border border-mm-crd rounded-xl text-sm text-mm-txs font-bold">
              {newProduct.cat}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Precio Minorista ($)" 
            type="number"
            value={newProduct.retailPrice || ''} 
            onChange={e => setNewOfferProduct(prev => ({ ...prev, retailPrice: Number(e.target.value) }))}
            placeholder="0"
            required
          />
          <Input 
            label="Stock Inicial" 
            type="number"
            value={newProduct.stock || ''} 
            onChange={e => setNewOfferProduct(prev => ({ ...prev, stock: Number(e.target.value) }))}
            placeholder="0"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input 
            label="Precio Mayorista ($)" 
            type="number"
            value={newProduct.wholesalePrice || ''} 
            onChange={e => setNewOfferProduct(prev => ({ ...prev, wholesalePrice: Number(e.target.value) }))}
            placeholder="Opcional"
          />
          <Input 
            label="Mínimo Mayorista" 
            type="number"
            value={newProduct.wholesaleMinQty || ''} 
            onChange={e => setNewOfferProduct(prev => ({ ...prev, wholesaleMinQty: Number(e.target.value) }))}
            placeholder="Ej: 10"
          />
          <Input 
            label="Pedido Mínimo (Retail)" 
            type="number"
            value={newProduct.minOrderQty || ''} 
            onChange={e => setNewOfferProduct(prev => ({ ...prev, minOrderQty: Number(e.target.value) }))}
            placeholder="Ej: 1"
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-mm-gbg/10 rounded-2xl border border-mm-crd">
          <input
            type="checkbox"
            id="isFeatured"
            checked={newProduct.isFeatured}
            onChange={e => setNewOfferProduct(prev => ({ ...prev, isFeatured: e.target.checked }))}
            className="w-5 h-5 rounded border-mm-crd text-mm-g focus:ring-mm-g"
          />
          <label htmlFor="isFeatured" className="text-sm font-bold text-mm-g cursor-pointer">
            Destacar este producto <span className="font-normal text-mm-txs">(máx. 5 por tienda)</span>
          </label>
        </div>

        <div className="pt-4 flex gap-3 border-t border-mm-gbg">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1">
            {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
