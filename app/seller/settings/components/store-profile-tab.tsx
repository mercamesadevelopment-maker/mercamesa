'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Image as ImageIcon, MapPin } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { useStoreProfile } from '../hooks/use-store-profile';
import { StoreContactFields } from '@/src/features/stores/components/StoreContactFields';
import { StoreSalesTypeFields } from '@/src/features/stores/components/StoreSalesTypeFields';
import { MultiSelect } from '@/components/ui/multi-select';

interface StoreProfileTabProps {
  storeId: string | null;
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function StoreProfileTab({ storeId }: StoreProfileTabProps) {
  const { store, categories, loading, saving, error, fetchStore, saveStore } =
    useStoreProfile(storeId);

  const [form, setForm] = useState({
    name: '',
    description: '',
    local_address: '',
    contact_name: '',
    contact_email: '',
    phone: '',
    whatsapp: '',
  });

  // Aparte del resto del formulario porque no son cadenas: las categorías son
  // varias y el tipo de venta son dos banderas.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [salesType, setSalesType] = useState({ is_wholesale: false, is_retail: true });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (storeId) fetchStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    if (!store) return;
    setForm({
      name: store.name || '',
      description: store.description || '',
      local_address: store.local_address || '',
      contact_name: store.contact_name || '',
      contact_email: store.contact_email || '',
      phone: store.phone || '',
      whatsapp: store.whatsapp || '',
    });
    setCategoryIds((store.categories ?? []).map((c) => c.id));
    setSalesType({
      is_wholesale: Boolean(store.is_wholesale),
      is_retail: Boolean(store.is_retail),
    });
    setLogoFile(null);
    setCoverFile(null);
    setLogoPreview(null);
    setCoverPreview(null);
  }, [store]);

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // El modal del admin dice "máximo 2MB" pero no lo comprueba en ningún lado.
  const pickImage = (kind: 'logo' | 'cover') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaved(false);
    setImageError(null);

    if (!file.type.startsWith('image/')) {
      setImageError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('La imagen no puede pesar más de 2 MB.');
      return;
    }

    const preview = URL.createObjectURL(file);
    if (kind === 'logo') {
      setLogoFile(file);
      setLogoPreview(preview);
    } else {
      setCoverFile(file);
      setCoverPreview(preview);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setImageError(null);

    const ok = await saveStore(
      {
        name: form.name,
        description: form.description || null,
        local_address: form.local_address || null,
        category_ids: categoryIds,
        is_wholesale: salesType.is_wholesale,
        is_retail: salesType.is_retail,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
      },
      { logo: logoFile, cover: coverFile }
    );

    if (ok) setSaved(true);
  };

  if (!storeId) {
    return (
      <p className="py-12 text-center text-sm text-mm-txw">
        Selecciona una tienda para editar sus datos.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  const logoSrc = logoPreview || store?.logoSignedUrl || null;
  const coverSrc = coverPreview || store?.coverSignedUrl || null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(error || imageError) && (
        <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">
          {imageError || error}
        </div>
      )}

      {saved && !error && (
        <div className="flex items-center gap-2 rounded-2xl bg-okl px-4 py-3 text-sm font-medium text-ok">
          <CheckCircle2 className="h-4 w-4" /> Datos de la tienda guardados.
        </div>
      )}

      {/* Imágenes */}
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-mm-txw">Logo</p>
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-mm-crd bg-mm-gbg">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-mm-txw" />
              )}
            </div>
            <div className="relative">
              <Button variant="outline" size="sm" type="button">Cambiar</Button>
              <input
                type="file"
                accept="image/*"
                onChange={pickImage('logo')}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </div>
        </div>

        <div className="flex-grow">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-mm-txw">Portada</p>
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-2xl border border-mm-crd bg-mm-gbg">
              {coverSrc ? (
                <img src={coverSrc} alt="Portada" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-mm-txw" />
              )}
            </div>
            <div className="relative">
              <Button variant="outline" size="sm" type="button">Cambiar</Button>
              <input
                type="file"
                accept="image/*"
                onChange={pickImage('cover')}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombre de la tienda" value={form.name} onChange={handleChange('name')} required />

        <MultiSelect
          label="Categorías de la tienda"
          placeholder="Sin categoría"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryIds}
          onChange={(ids) => {
            setSaved(false);
            setCategoryIds(ids);
          }}
          hint="Elige todas las que vendas; el comprador te encuentra por cada una."
        />

        <StoreSalesTypeFields
          values={salesType}
          onChange={(field, value) => {
            setSaved(false);
            setSalesType((prev) => ({ ...prev, [field]: value }));
          }}
        />

        <div className="sm:col-span-2">
          <Input
            label="Ubicación dentro de la plaza"
            value={form.local_address}
            onChange={handleChange('local_address')}
            placeholder="Ej: Local 234, pasillo 3"
          />
          <p className="ml-1 mt-1.5 flex items-start gap-1.5 text-xs text-mm-txw">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Le sirve al comprador para encontrarte
              {store?.marketplaces?.name ? ` dentro de ${store.marketplaces.name}` : ''}. Los envíos
              se recogen en la dirección de la plaza, así que esto no cambia el costo del domicilio.
            </span>
          </p>
        </div>

        <div className="sm:col-span-2 flex w-full flex-col gap-1.5">
          <label className="ml-1 text-sm font-medium text-mm-txs">Descripción</label>
          <textarea
            value={form.description}
            onChange={handleChange('description')}
            rows={3}
            placeholder="Cuéntale al comprador qué vendes y qué te distingue."
            className="rounded-xl border border-mm-crd bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-mm-g"
          />
        </div>

        {/* El mismo bloque que usa el admin desde /admin/stores. */}
        <StoreContactFields
          className="sm:col-span-2"
          values={{
            contact_name: form.contact_name,
            contact_email: form.contact_email,
            phone: form.phone,
            whatsapp: form.whatsapp,
          }}
          onChange={(field, value) => {
            setSaved(false);
            setForm((prev) => ({ ...prev, [field]: value }));
          }}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Guardar cambios</Button>
      </div>
    </form>
  );
}
