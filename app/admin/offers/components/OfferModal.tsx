import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { Database } from '../../../../types/database_generated';
import { StoreOffer } from '../hooks/useOffers';

type StoreProduct = Database['public']['Tables']['store_products']['Row'] & {
  catalog_products?: { name: string } | null;
};

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: Partial<StoreOffer>) => Promise<boolean>;
  initialData: StoreOffer | null;
}

export function OfferModal({ isOpen, onClose, onSave, initialData }: OfferModalProps) {
  const [loading, setLoading] = useState(false);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  
  const [formData, setFormData] = useState({
    store_product_id: '',
    label: '',
    discount_pct: '',
    special_price: '',
    starts_at: new Date().toISOString().split('T')[0], // Default to today
    ends_at: '',
    is_active: true,
  });

  useEffect(() => {
    // Fetch store products to populate the dropdown
    // In a real scenario you might want to filter by the current user's store
    fetch('/api/store-products')
      .then(res => res.json())
      .then(data => { if (data.data) setStoreProducts(data.data); });
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        store_product_id: initialData.store_product_id,
        label: initialData.label || '',
        discount_pct: initialData.discount_pct?.toString() || '',
        special_price: initialData.special_price?.toString() || '',
        starts_at: initialData.starts_at.split('T')[0], // Format for date input
        ends_at: initialData.ends_at ? initialData.ends_at.split('T')[0] : '',
        is_active: initialData.is_active,
      });
    } else {
      setFormData({
        store_product_id: '',
        label: '',
        discount_pct: '',
        special_price: '',
        starts_at: new Date().toISOString().split('T')[0],
        ends_at: '',
        is_active: true,
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
      // Ensure we format dates correctly for Supabase (Timestamptz)
      const submitData: any = { ...formData };
      submitData.starts_at = new Date(formData.starts_at).toISOString();
      if (formData.ends_at) {
        submitData.ends_at = new Date(formData.ends_at).toISOString();
      } else {
        submitData.ends_at = null;
      }

      const success = await onSave(initialData?.id || null, submitData as Partial<StoreOffer>);
      if (success) onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Oferta' : 'Nueva Oferta'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-mm-txs ml-1">Producto de la Tienda</label>
          <select name="store_product_id" value={formData.store_product_id} onChange={handleChange} required disabled={!!initialData}
            className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm disabled:opacity-50">
            <option value="">Selecciona un producto</option>
            {storeProducts.map(p => <option key={p.id} value={p.id}>{p.catalog_products?.name || p.id}</option>)}
          </select>
        </div>

        <Input label="Etiqueta Promocional (Opcional)" name="label" value={formData.label} onChange={handleChange} placeholder="Ej: ¡Oferta de la Semana!" />

        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Porcentaje de Descuento (%)" name="discount_pct" type="number" step="0.01" value={formData.discount_pct} onChange={handleChange} placeholder="Ej: 15" />
          <Input label="Precio Especial ($)" name="special_price" type="number" step="0.01" value={formData.special_price} onChange={handleChange} placeholder="Ej: 2000" />
        </div>
        <p className="text-[10px] text-mm-txw ml-1 -mt-4">Nota: Usa el porcentaje o el precio fijo. Si usas ambos, se priorizará el precio fijo según la lógica de tu negocio.</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Fecha de Inicio" name="starts_at" type="date" value={formData.starts_at} onChange={handleChange} required />
          <Input label="Fecha de Fin (Opcional)" name="ends_at" type="date" value={formData.ends_at} onChange={handleChange} />
        </div>

        <div className="flex items-center gap-2 px-1">
          <input type="checkbox" id="is_active" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
          <label htmlFor="is_active" className="text-sm font-medium text-mm-txs">Oferta Activa</label>
        </div>

        <div className="pt-2 flex gap-3 pb-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {initialData ? 'Guardar Cambios' : 'Crear Oferta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
