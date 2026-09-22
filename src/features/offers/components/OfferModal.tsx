import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select';
import { parseAmount, validateOffer, formatCop, offerFinalPrice } from '@/lib/offers/validate-offer';
import type { StoreOffer } from '../types/offer.types';

interface StoreProduct {
  id: string;
  store_id: string;
  price_per_unit: number;
  stock?: number;
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

/** El descuento se expresa de una sola forma; no se pueden mezclar. */
type DiscountMode = 'pct' | 'price';

export function OfferModal({ isOpen, onClose, onSave, initialData, storeId, allowFeatured = true, allowStatusEdit = true }: OfferModalProps) {
  const [loading, setLoading] = useState(false);
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mode, setMode] = useState<DiscountMode>('pct');

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
    setValidationError(null);
    if (initialData) {
      setMode(initialData.special_price != null ? 'price' : 'pct');
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
      setMode('pct');
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

  /**
   * El producto escogido manda: de él salen la unidad de medida y el precio.
   * La oferta NO tiene unidad propia —cuelga del producto y hereda la suya— así
   * que se muestra de solo lectura. Es la forma de garantizar que la unidad de
   * la oferta coincida siempre con la del inventario.
   */
  const selectedProduct = useMemo(
    () => storeProducts.find((p) => p.id === formData.store_product_id) || null,
    [storeProducts, formData.store_product_id]
  );

  const unit = selectedProduct?.measurement_units?.abbreviation || null;
  const basePrice = selectedProduct ? Number(selectedProduct.price_per_unit) : null;
  const storeName = initialData?.store_products?.stores?.name;

  const preview = useMemo(() => {
    if (basePrice === null) return null;
    const discountPct = mode === 'pct' ? parseAmount(formData.discount_pct) : null;
    const specialPrice = mode === 'price' ? parseAmount(formData.special_price) : null;
    if (discountPct === null && specialPrice === null) return null;
    return offerFinalPrice(basePrice, discountPct, specialPrice);
  }, [basePrice, mode, formData.discount_pct, formData.special_price]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setValidationError(null);
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleModeChange = (next: DiscountMode) => {
    setMode(next);
    setValidationError(null);
    // Limpiar el otro campo: si quedaran ambos con valor, la API rechazaría.
    setFormData(prev => ({
      ...prev,
      discount_pct: next === 'pct' ? prev.discount_pct : '',
      special_price: next === 'price' ? prev.special_price : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.store_product_id) {
      setValidationError('Debes escoger un producto.');
      return;
    }

    const discountPct = mode === 'pct' ? parseAmount(formData.discount_pct) : null;
    const specialPrice = mode === 'price' ? parseAmount(formData.special_price) : null;

    // Las mismas reglas que aplica el servidor, para avisar sin ida y vuelta.
    const invalid = validateOffer(
      { discountPct, specialPrice, startsAt: formData.starts_at, endsAt: formData.ends_at || null },
      basePrice !== null ? { pricePerUnit: basePrice } : null
    );
    if (invalid) {
      setValidationError(invalid);
      return;
    }

    setLoading(true);
    try {
      const submitData: any = {
        store_product_id: formData.store_product_id,
        label: formData.label,
        discount_pct: discountPct,
        special_price: specialPrice,
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      };

      if (allowFeatured) submitData.is_featured = formData.is_featured;
      if (allowStatusEdit) submitData.status = formData.status;

      const success = await onSave(initialData?.id || null, submitData as Partial<StoreOffer>);
      if (success) onClose();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'No se pudo guardar la oferta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? `Editar Oferta${storeName ? ` — ${storeName}` : ''}` : 'Nueva Oferta'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {validationError && (
          <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">
            {validationError}
          </div>
        )}

        <SearchableSelect
          label="Producto de la Tienda"
          required
          disabled={!!initialData}
          value={formData.store_product_id}
          onChange={(val) => { setValidationError(null); setFormData(prev => ({ ...prev, store_product_id: val })); }}
          placeholder="Selecciona un producto..."
          options={productOptions}
        />

        {/* Unidad y precio del inventario, de solo lectura: la oferta hereda la
            unidad del producto, así que no puede contradecirla. */}
        {selectedProduct && (
          <div className="rounded-2xl border border-mm-crd bg-mm-gbg/20 p-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-mm-txw">
              Según tu inventario
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-mm-txw">Unidad de medida</p>
                <p className="text-sm font-bold text-mm-g">{unit || 'Sin unidad'}</p>
              </div>
              <div>
                <p className="text-[11px] text-mm-txw">Precio actual</p>
                <p className="text-sm font-bold text-mm-g">
                  {basePrice !== null ? `${formatCop(basePrice)}${unit ? ` / ${unit}` : ''}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-mm-txw">Existencias</p>
                <p className="text-sm font-bold text-mm-g">
                  {selectedProduct.stock != null ? `${selectedProduct.stock}${unit ? ` ${unit}` : ''}` : '—'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-mm-txs">
              La oferta usa esta misma unidad. Para ofrecer otra presentación, publícala como
              producto aparte en tu inventario.
            </p>
          </div>
        )}

        <Input label="Etiqueta Promocional (Opcional)" name="label" value={formData.label} onChange={handleChange} placeholder="Ej: ¡Oferta de la Semana!" />

        <div className="space-y-3">
          <label className="ml-1 text-sm font-medium text-mm-txs">¿Cómo quieres aplicar el descuento? *</label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('pct')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                mode === 'pct'
                  ? 'border-mm-g bg-mm-g text-white'
                  : 'border-mm-crd bg-white text-mm-txs hover:border-mm-g'
              }`}
            >
              Porcentaje
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('price')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                mode === 'price'
                  ? 'border-mm-g bg-mm-g text-white'
                  : 'border-mm-crd bg-white text-mm-txs hover:border-mm-g'
              }`}
            >
              Precio especial
            </button>
          </div>

          {mode === 'pct' ? (
            <Input
              label="Porcentaje de Descuento (%)"
              name="discount_pct"
              type="number"
              step="0.01"
              min="0.01"
              max="99.99"
              required
              value={formData.discount_pct}
              onChange={handleChange}
              placeholder="Ej: 15"
            />
          ) : (
            <Input
              label={unit ? `Precio especial por ${unit} ($)` : 'Precio Especial ($)'}
              name="special_price"
              type="number"
              step="0.01"
              min="1"
              required
              value={formData.special_price}
              onChange={handleChange}
              placeholder="Ej: 2000"
            />
          )}

          {preview !== null && basePrice !== null && (
            <p className="ml-1 text-xs text-mm-txs">
              El comprador pagaría{' '}
              <span className="font-bold text-mm-g">
                {formatCop(preview)}{unit ? ` / ${unit}` : ''}
              </span>{' '}
              en vez de {formatCop(basePrice)}.
            </p>
          )}
        </div>

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
