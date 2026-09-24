import React, { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { Database } from '../../../../types/database_generated';
import {
  WeeklyHoursEditor,
  createDefaultBusinessHours,
  type BusinessHours,
} from '@/components/ui/business-hours/business-hours-editor';
import { uploadImageDirect } from '@/lib/supabase/client-upload';
import { StoreContactFields } from '@/src/features/stores/components/StoreContactFields';
import { StoreSalesTypeFields } from '@/src/features/stores/components/StoreSalesTypeFields';
import { StorePickupFields, type StorePickupValues } from '@/src/features/stores/components/StorePickupFields';
import { MultiSelect } from '@/components/ui/multi-select';
import { validateStoreFields, STORE_DESCRIPTION_MAX_LENGTH } from '@/lib/stores/validate-store';

type Store = Database['public']['Tables']['stores']['Row'] & {
  coverSignedUrl?: string | null;
  logoSignedUrl?: string | null;
};
type Marketplace = Database['public']['Tables']['marketplaces']['Row'];
type StoreCategory = Database['public']['Tables']['store_categories']['Row'];

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: Record<string, unknown>) => Promise<void>;
  initialData: Store | null;
}

export function StoreModal({ isOpen, onClose, onSave, initialData }: StoreModalProps) {
  const [loading, setLoading] = useState(false);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>([]);
  const [formData, setFormData] = useState({
    name: '', slug: '', marketplace_id: '', description: '',
    contact_name: '', contact_email: '', phone: '', whatsapp: '', is_active: true,
  });
  // Aparte de `formData`, que es todo cadenas: las categorías son varias y el
  // tipo de venta son dos banderas.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [salesType, setSalesType] = useState({ is_wholesale: false, is_retail: true });
  // Aparte porque las coordenadas son números en la base pero texto en el
  // formulario, igual que en el modal de plazas.
  const [pickup, setPickup] = useState<StorePickupValues>({
    address: '', city: '', department: '', latitude: '', longitude: '',
  });
  const [businessHours, setBusinessHours] = useState<BusinessHours>(createDefaultBusinessHours());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  // Errores de formato (nombre/descripción/correo) que no dependen del servidor;
  // se revisan antes de enviar, para no gastar un viaje a la API en algo que ya
  // se sabe que va a fallar.
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/marketplaces')
      .then(res => res.json())
      .then(data => { if (data.data) setMarketplaces(data.data); });

    fetch('/api/store-categories')
      .then(res => res.json())
      .then(data => { if (data.data) setStoreCategories(data.data); });
  }, []);

  useEffect(() => {
    setEmailError(null);
    if (initialData) {
      setFormData({
        name: initialData.name || '', slug: initialData.slug || '',
        marketplace_id: initialData.marketplace_id || '',
        description: initialData.description || '',
        contact_name: initialData.contact_name || '',
        contact_email: initialData.contact_email || '',
        phone: initialData.phone || '',
        whatsapp: initialData.whatsapp || '',
        is_active: initialData.is_active,
      });
      setCategoryIds(
        ((initialData as any).categories ?? []).map((c: { id: string }) => c.id)
      );
      setSalesType({
        is_wholesale: Boolean((initialData as any).is_wholesale),
        is_retail: Boolean((initialData as any).is_retail),
      });
      const initialHours = (initialData as any).business_hours;
      setBusinessHours(
        Array.isArray(initialHours) && initialHours.length === 7
          ? initialHours
          : createDefaultBusinessHours()
      );
      setPickup({
        address: (initialData as any).address || '',
        city: (initialData as any).city || '',
        department: (initialData as any).department || '',
        latitude: (initialData as any).latitude?.toString() || '',
        longitude: (initialData as any).longitude?.toString() || '',
      });
      setLogoPreview(initialData.logoSignedUrl || null);
    } else {
      setFormData({
        name: '', slug: '',
        marketplace_id: marketplaces.length > 0 ? marketplaces[0].id : '',
        description: '', contact_name: '', contact_email: '',
        phone: '', whatsapp: '', is_active: true,
      });
      setCategoryIds([]);
      setSalesType({ is_wholesale: false, is_retail: true });
      setBusinessHours(createDefaultBusinessHours());
      setPickup({ address: '', city: '', department: '', latitude: '', longitude: '' });
      setLogoPreview(null);
    }
    setLogoFile(null);
  }, [initialData, marketplaces]);

  useEffect(() => {
    if (!initialData && formData.name) {
      setFormData(prev => ({
        ...prev,
        slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      }));
    }
  }, [formData.name, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    if (name === 'contact_email') setEmailError(null);
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setFormError(null);

    // Correo malformado o descripción demasiado larga: se avisa acá, antes de
    // subir el logo o llamar a la API, que igual las rechazaría.
    const fieldsError = validateStoreFields({
      name: formData.name,
      description: formData.description,
      contactEmail: formData.contact_email,
    });
    if (fieldsError) {
      setFormError(fieldsError);
      return;
    }

    // La API lo rechaza igual, pero avisar acá ahorra el viaje y deja el aviso
    // al lado del mapa, que es donde se arregla.
    if (pickup.address.trim() && !(pickup.latitude && pickup.longitude)) {
      setFormError('Marca el punto en el mapa para poder guardar la dirección de recogida.');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        business_hours: businessHours,
        category_ids: categoryIds,
        ...salesType,
        ...pickup,
      };

      if (logoFile) {
        const id = initialData?.id || crypto.randomUUID();
        const path = `imgs/${id}/logo-${Date.now()}.${logoFile.name.split('.').pop()}`;
        await uploadImageDirect('stores', path, logoFile);
        payload.id = id;
        payload.logo_url = path;
      }

      await onSave(initialData?.id || null, payload);
      onClose();
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || '';
      if (errMsg.includes('correo de contacto ya está registrado') || errMsg.includes('Correo de Contacto ya está registrado')) {
        setEmailError(errMsg);
      } else {
        alert(errMsg || 'Error al guardar la tienda');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Tienda' : 'Nueva Tienda'}>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {/* Logo */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-mm-txs ml-1">Logo de la Tienda</label>
          <div className="flex gap-4 items-center">
            <div className="w-24 h-24 bg-mm-gbg rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-2 border-dashed border-mm-crd relative">
              {logoPreview
                ? <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                : <div className="flex flex-col items-center gap-1">
                  <ImageIcon className="w-6 h-6 text-mm-txw" />
                  <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                </div>
              }
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <p className="text-xs text-mm-txw max-w-[200px]">Sube un logo cuadrado (1:1). Máximo 2MB.</p>
          </div>
        </div>

        {/* Nombre + Slug */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Nombre de la Tienda" name="name" value={formData.name} onChange={handleChange} required placeholder="Ej: Frutas y Verduras Don Pepe" />
          <Input label="Identificador" name="slug" value={formData.slug} onChange={handleChange} required placeholder="ej-frutas-don-pepe" />
        </div>

        {/* Marketplace + Categoría */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-mm-txs ml-1">Plaza (Marketplace)</label>
            <select name="marketplace_id" value={formData.marketplace_id} onChange={handleChange} required
              className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
              <option value="">Selecciona una plaza</option>
              {marketplaces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <MultiSelect
            label="Categorías de la Tienda"
            placeholder="Sin categoría"
            options={storeCategories.map(c => ({ value: c.id, label: c.name }))}
            value={categoryIds}
            onChange={setCategoryIds}
          />
        </div>

        <StoreSalesTypeFields
          values={salesType}
          onChange={(field, value) => setSalesType(prev => ({ ...prev, [field]: value }))}
        />

        {/* Descripción */}
        <div className="flex flex-col gap-1">
          <Input
            label="Descripción"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Breve descripción de la tienda"
            maxLength={STORE_DESCRIPTION_MAX_LENGTH}
          />
          <span className="text-[10px] text-mm-txw ml-1">
            {formData.description.length}/{STORE_DESCRIPTION_MAX_LENGTH}
          </span>
        </div>

        {/* Horario de atención */}
        <WeeklyHoursEditor value={businessHours} onChange={setBusinessHours} />

        {/* Dónde recoge el mensajero. Vacío = se recoge en la plaza. */}
        <StorePickupFields
          values={pickup}
          onChange={setPickup}
          marketplaceName={
            marketplaces.find((m) => m.id === formData.marketplace_id)?.name ?? null
          }
        />

        {/* Contacto, teléfono y WhatsApp: el mismo bloque que edita el tendero
            desde su panel, compartido para que no se separen con el tiempo. */}
        <StoreContactFields
          values={{
            contact_name: formData.contact_name,
            contact_email: formData.contact_email,
            phone: formData.phone,
            whatsapp: formData.whatsapp,
          }}
          onChange={(field, value) => {
            if (field === 'contact_email') setEmailError(null);
            setFormData((prev) => ({ ...prev, [field]: value }));
          }}
          emailError={emailError}
        />

        {formError && (
          <div className="text-sm text-r bg-rl px-4 py-2.5 rounded-xl">{formError}</div>
        )}

        {/* Activa */}
        <div className="flex items-center gap-2 px-1">
          <input type="checkbox" id="is_active" name="is_active" checked={formData.is_active} onChange={handleChange}
            className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
          <label htmlFor="is_active" className="text-sm font-medium text-mm-txs">Tienda Activa</label>
        </div>

        {/* Botones */}
        <div className="pt-2 flex gap-3 pb-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {initialData ? 'Guardar Cambios' : 'Crear Tienda'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}