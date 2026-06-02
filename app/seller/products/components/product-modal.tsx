import React from 'react';
import { motion } from 'motion/react';
import { Image as ImageIcon } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input, Badge } from '@/src/components/Shared';
import { MasterProduct, Product } from '@/src/types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  catalog: MasterProduct[];
  newProduct: {
    name: string;
    retailPrice: number;
    stock: number;
    unit: string;
    emoji: string;
    cat: string;
    image: string;
    masterId: any;
  };
  setNewOfferProduct: React.Dispatch<React.SetStateAction<{
    name: string;
    retailPrice: number;
    stock: number;
    unit: string;
    emoji: string;
    cat: string;
    image: string;
    masterId: any;
  }>>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProductModal({
  isOpen,
  onClose,
  editingProduct,
  catalog,
  newProduct,
  setNewOfferProduct,
  onImageUpload,
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
            <div className="w-24 h-24 bg-mm-gbg/20 rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border-2 border-dashed border-mm-crd group relative">
              {newProduct.image ? (
                <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <ImageIcon className="w-6 h-6 text-mm-txw" />
                  <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={onImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex-grow flex flex-col justify-center">
              <p className="text-[10px] text-mm-txw leading-tight">Sube una foto real de tu producto para generar más confianza.</p>
              {newProduct.masterId > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  type="button"
                  className="mt-2 text-[10px] h-7 w-fit border border-mm-crd"
                  onClick={() => {
                    const master = catalog.find(i => i.id === newProduct.masterId);
                    if (master) setNewOfferProduct(prev => ({ ...prev, image: master.image || '' }));
                  }}
                >
                  Usar imagen del catálogo
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-mm-txs ml-1">Nombre del Producto</label>
          <select 
            value={newProduct.masterId}
            onChange={e => {
              const mid = e.target.value;
              const master = catalog.find(i => String(i.id) === String(mid));
              if (master) {
                setNewOfferProduct(prev => ({
                  ...prev,
                  masterId: mid,
                  name: master.name,
                  cat: master.cat,
                  image: master.image || '',
                  unit: master.defaultUnit,
                  emoji: master.emoji
                }));
              }
            }}
            className="px-4 py-2.5 rounded-xl border-1.5 border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm"
            required
          >
            <option value="">Seleccione un producto...</option>
            {Array.from(new Set(catalog.map(i => i.cat))).map(cat => (
              <optgroup key={cat} label={cat}>
                {catalog
                  .filter(i => i.cat === cat)
                  .map(item => (
                    <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>
                  ))
                }
              </optgroup>
            ))}
          </select>
        </div>

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
          <Input 
            label="Unidad" 
            value={newProduct.unit} 
            onChange={e => setNewOfferProduct(prev => ({ ...prev, unit: e.target.value }))}
            placeholder="Ej: kg, lb, unidad"
            required
          />
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
