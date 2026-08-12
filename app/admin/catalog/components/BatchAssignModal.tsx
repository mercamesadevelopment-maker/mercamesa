import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { Database } from '../../../../types/database_generated';

type CatalogProduct = Database['public']['Tables']['catalog_products']['Row'];
type Store = Database['public']['Tables']['stores']['Row'];
type Unit = Database['public']['Tables']['measurement_units']['Row'];

interface BatchAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductIds: string[];
  onSave: (data: any[]) => Promise<boolean>;
}

export function BatchAssignModal({ isOpen, onClose, selectedProductIds, onSave }: BatchAssignModalProps) {
  const [loading, setLoading] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [formData, setFormData] = useState({
    store_id: '',
    unit_selection: 'default', // 'default' or specific unit_id
    price_per_unit: '',
    stock: '0',
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

  // Un producto exclusivo de un grupo solo lo pueden publicar las tiendas de ese
  // grupo. El servidor lo rechaza igual con 403, pero es mejor no ofrecer una
  // combinación que va a fallar.
  const requiredGroupIds = React.useMemo(() => {
    const selected = new Set(selectedProductIds);
    return new Set(
      catalogProducts
        .filter((product) => selected.has(product.id) && product.owner_group_id)
        .map((product) => product.owner_group_id as string)
    );
  }, [catalogProducts, selectedProductIds]);

  const eligibleStores = React.useMemo(() => {
    if (requiredGroupIds.size === 0) return stores;
    // Con productos de dos grupos distintos en la misma selección no hay tienda
    // que pueda recibirlos todos.
    if (requiredGroupIds.size > 1) return [];
    const [groupId] = Array.from(requiredGroupIds);
    return stores.filter((store) => store.store_group_id === groupId);
  }, [stores, requiredGroupIds]);

  // Si la tienda elegida deja de ser elegible al cambiar la selección, se limpia
  // para no enviar una asignación que el servidor va a rechazar.
  useEffect(() => {
    if (formData.store_id && !eligibleStores.some((store) => store.id === formData.store_id)) {
      setFormData((prev) => ({ ...prev, store_id: '' }));
    }
  }, [eligibleStores, formData.store_id]);

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
      const payload = selectedProductIds.map(catalogProductId => {
        let finalUnitId = '';
        if (formData.unit_selection === 'default') {
          const catProd = catalogProducts.find(p => p.id === catalogProductId);
          finalUnitId = catProd?.default_unit_id || (units.length > 0 ? units[0].id : '');
        } else {
          finalUnitId = formData.unit_selection;
        }

        return {
          catalog_product_id: catalogProductId,
          store_id: formData.store_id,
          unit_id: finalUnitId,
          price_per_unit: Number(formData.price_per_unit || 0),
          stock: Number(formData.stock || 0),
          min_order_qty: Number(formData.min_order_qty || 1),
          wholesale_price: formData.wholesale_price ? Number(formData.wholesale_price) : null,
          wholesale_min_qty: formData.wholesale_min_qty ? Number(formData.wholesale_min_qty) : null,
          is_active: formData.is_active,
        };
      });

      const success = await onSave(payload);
      if (success) onClose();
    } catch (err) {
      console.error('Error in batch submit:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Asignar ${selectedProductIds.length} Productos a Tienda`} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        {/* Tienda */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-mm-txs ml-1">Tienda Destino</label>
          <select name="store_id" value={formData.store_id} onChange={handleChange} required
            className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
            <option value="">Selecciona una tienda</option>
            {eligibleStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {requiredGroupIds.size > 1 && (
            <p className="text-xs text-r ml-1">
              La selección mezcla productos exclusivos de grupos distintos: ninguna tienda puede
              recibirlos todos. Asígnalos por separado.
            </p>
          )}
          {requiredGroupIds.size === 1 && (
            <p className="text-xs text-mm-txw ml-1">
              {eligibleStores.length > 0
                ? 'Solo se listan las tiendas del grupo dueño de estos productos.'
                : 'Ninguna tienda pertenece al grupo dueño de estos productos. Asígnale tiendas al grupo en Parametrización → Grupos de Tiendas.'}
            </p>
          )}
        </div>

        {/* Unidad, Precio y Stock */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-mm-txs ml-1">Unidad de Medida</label>
            <select name="unit_selection" value={formData.unit_selection} onChange={handleChange} required
              className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
              <option value="default">Unidad por defecto del producto</option>
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
            Asignar Productos
          </Button>
        </div>
      </form>
    </Modal>
  );
}
