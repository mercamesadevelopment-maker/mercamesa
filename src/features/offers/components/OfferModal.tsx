import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select';
import type { StoreOffer } from '../types/offer.types';

interface StoreProduct {
  id: string;
  store_id: string;
  price_per_unit: number;
  catalog_products?: {
    name: string;
    categories?: {
      name: string;
      parent?: { name: string } | null;
    } | null;
  } | null;
  stores?: { name: string } | null;
  measurement_units?: { abbreviation: string } | null;
}

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: Partial<StoreOffer>) => Promise<boolean>;
  initialData: StoreOffer | null;
  storeId?: string;
  allowFeatured?: boolean;
  allowStatusEdit?: boolean;
}

export function OfferModal({ isOpen, onClose, onSave, initialData, storeId, allowFeatured = true, allowStatusEdit = true }: OfferModalProps) {
  const [loading, setLoading] = useState(false);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);

  const [formData, setFormData] = useState({
    store_product_id: '',
    label: '',
    discount_pct: '',
    special_price: '',
    starts_at: new Date().toISOString().split('T')[0], // Default to today
    ends_at: '',
    status: 'pending',
    is_featured: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    const url = storeId ? `/api/store-products?store_id=${storeId}` : '/api/store-products';
    fetch(url)
      .then(res => res.json())
      .then(data => { if (data.data) setStoreProducts(data.data); });
  }, [isOpen, storeId]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        store_product_id: initialData.store_product_id,
        label: initialData.label || '',
        discount_pct: initialData.discount_pct?.toString() || '',
        special_price: initialData.special_price?.toString() || '',
        starts_at: initialData.starts_at.split('T')[0], // Format for date input
        ends_at: initialData.ends_at ? initialData.ends_at.split('T')[0] : '',
        status: initialData.status,
        is_featured: initialData.is_featured,
      });
    } else {
      setFormData({
        store_product_id: '',
        label: '',
        discount_pct: '',
        special_price: '',
        starts_at: new Date().toISOString().split('T')[0],
        ends_at: '',
        status: 'pending',
        is_featured: false,
      });
    }
  }, [initialData]);

  const productOptions: SelectOption[] = useMemo(() => {
    return storeProducts.map((p) => {
      const category = p.catalog_products?.categories;
      const group = category
        ? (category.parent?.name ? `${category.parent.name} > ${category.name}` : category.name)
        : 'Sin categoría';
      const unit = p.measurement_units?.abbreviation;
      const name = p.catalog_products?.name || p.id;
      let label = unit ? `${name} (${unit})` : name;
      if (!storeId && p.stores?.name) {
        label = `${label} — ${p.stores.name}`;
      }
      return { value: p.id, label, group };
    });
  }, [storeProducts, storeId]);

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
      if (!allowFeatured) {
        delete submitData.is_featured;
      }
      if (!allowStatusEdit) {
        delete submitData.status;
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

        <SearchableSelect
          label="Producto de la Tienda"
          required
          disabled={!!initialData}
          value={formData.store_product_id}
          onChange={(val) => setFormData(prev => ({ ...prev, store_product_id: val }))}
          placeholder="Selecciona un producto..."
          options={productOptions}
        />

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

        {(allowStatusEdit || allowFeatured) && (
          <div className="grid sm:grid-cols-2 gap-4 items-end">
            {allowStatusEdit && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-mm-txs ml-1">Estado de la oferta</label>
                <select name="status" value={formData.status} onChange={handleChange}
                  className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
                  <option value="pending">Pendiente</option>
                  <option value="verified">Verificada</option>
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </div>
            )}

            {allowFeatured && (
              <div className="flex items-center gap-2 px-1 pb-2.5">
                <input type="checkbox" id="is_featured" name="is_featured" checked={formData.is_featured} onChange={handleChange} className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
                <label htmlFor="is_featured" className="text-sm font-medium text-mm-txs">Oferta Destacada</label>
              </div>
            )}
          </div>
        )}

        {!allowStatusEdit && !initialData && (
          <p className="text-[10px] text-mm-txw ml-1 -mt-2">Tu oferta será revisada por el equipo de Mercamesa.</p>
        )}

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
