import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { Database } from '../../../../types/database_generated';

type StoreProduct = Database['public']['Tables']['store_products']['Row'];
type CatalogProduct = Database['public']['Tables']['catalog_products']['Row'];
type Store = Database['public']['Tables']['stores']['Row'];
type Unit = Database['public']['Tables']['measurement_units']['Row'];

interface StoreProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: Partial<StoreProduct>) => Promise<boolean>;
  initialData: StoreProduct | null;
}

export function StoreProductModal({ isOpen, onClose, onSave, initialData }: StoreProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [formData, setFormData] = useState({
    catalog_product_id: '',
    store_id: '',
    unit_id: '',
    price_per_unit: '',
    stock: '',
    min_order_qty: '1',
    wholesale_price: '',
    wholesale_min_qty: '',
    is_active: true,
  });

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(data => { if (data.data) setCatalogProducts(data.data); });
    fetch('/api/stores').then(res => res.json()).then(data => { if (data.data) setStores(data.data); });
    fetch('/api/measurement-units').then(res => res.json()).then(data => { if (data.data) setUnits(data.data); });
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        catalog_product_id: initialData.catalog_product_id,
        store_id: initialData.store_id,
        unit_id: initialData.unit_id,
        price_per_unit: initialData.price_per_unit.toString(),
        stock: initialData.stock.toString(),
        min_order_qty: initialData.min_order_qty.toString(),
        wholesale_price: initialData.wholesale_price?.toString() || '',
        wholesale_min_qty: initialData.wholesale_min_qty?.toString() || '',
        is_active: initialData.is_active,
      });
    } else {
      setFormData({
        catalog_product_id: '', store_id: '', unit_id: '',
        price_per_unit: '', stock: '0', min_order_qty: '1',
        wholesale_price: '', wholesale_min_qty: '', is_active: true,
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await onSave(initialData?.id || null, formData as unknown as Partial<StoreProduct>);
      if (success) onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Producto de Tienda' : 'Asignar Producto a Tienda'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* Producto y Tienda */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-mm-txs ml-1">Producto del Catálogo</label>
            <select name="catalog_product_id" value={formData.catalog_product_id} onChange={handleChange} required disabled={!!initialData}
              className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm disabled:opacity-50">
              <option value="">Selecciona un producto</option>
              {catalogProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-mm-txs ml-1">Tienda</label>
            <select name="store_id" value={formData.store_id} onChange={handleChange} required disabled={!!initialData}
              className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm disabled:opacity-50">
              <option value="">Selecciona una tienda</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Unidad, Precio y Stock */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-mm-txs ml-1">Unidad de Medida</label>
            <select name="unit_id" value={formData.unit_id} onChange={handleChange} required
              className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
              <option value="">Selecciona unidad</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
            </select>
          </div>
          <Input label="Precio por Unidad" name="price_per_unit" type="number" value={formData.price_per_unit} onChange={handleChange} required placeholder="Ej: 2500" />
          <Input label="Stock Disponible" name="stock" type="number" value={formData.stock} onChange={handleChange} required placeholder="Ej: 100" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Input label="Pedido Mínimo (Detal)" name="min_order_qty" type="number" value={formData.min_order_qty} onChange={handleChange} required placeholder="Ej: 1" />
          <Input label="Precio Mayorista" name="wholesale_price" type="number" value={formData.wholesale_price} onChange={handleChange} placeholder="Opcional" />
          <Input label="Cant. Mínima Mayorista" name="wholesale_min_qty" type="number" value={formData.wholesale_min_qty} onChange={handleChange} placeholder="Opcional" />
        </div>

        <div className="flex items-center gap-2 px-1">
          <input type="checkbox" id="is_active" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
          <label htmlFor="is_active" className="text-sm font-medium text-mm-txs">Disponible para la venta</label>
        </div>

        <div className="pt-2 flex gap-3 pb-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {initialData ? 'Guardar Cambios' : 'Asignar a Tienda'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
