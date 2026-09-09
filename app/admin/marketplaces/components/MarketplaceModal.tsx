import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { Database } from '../../../../types/database_generated';
import { Input, Button } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { getStoragePublicUrl } from '@/lib/supabase/utils';
import {
  WeeklyHoursEditor,
  createDefaultBusinessHours,
  type BusinessHours,
} from '@/components/ui/business-hours/business-hours-editor';
import { uploadImageDirect } from '@/lib/supabase/client-upload';
import { MapPicker, type MapPickerChange } from '@/components/ui/map-picker/MapPicker';
import { toCoordinate, validateColombiaCoordinates } from '@/lib/geocoding/mapbox';

type Marketplace = Database['public']['Tables']['marketplaces']['Row'];

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>, id?: string) => Promise<boolean>;
  initialData?: Marketplace | null;
}

export function MarketplaceModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: MarketplaceModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    city: '',
    department: '',
    address: '',
    description: '',
    latitude: '',
    longitude: '',
    is_active: true,
  });

  const [businessHours, setBusinessHours] = useState<BusinessHours>(createDefaultBusinessHours());
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [previewCover, setPreviewCover] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        slug: initialData.slug || '',
        city: initialData.city || '',
        department: initialData.department || '',
        address: initialData.address || '',
        description: initialData.description || '',
        latitude: initialData.latitude?.toString() || '',
        longitude: initialData.longitude?.toString() || '',
        is_active: initialData.is_active,
      });

      const initialHours = (initialData as any).business_hours;
      setBusinessHours(
        Array.isArray(initialHours) && initialHours.length === 7
          ? initialHours
          : createDefaultBusinessHours()
      );

      // Set initial logo and cover image previews
      const initialLogo = (initialData as any).logoSignedUrl || getStoragePublicUrl('plazas', initialData.logo_url);
      const initialCover = (initialData as any).coverSignedUrl || getStoragePublicUrl('plazas', initialData.cover_image_url);
      setPreviewLogo(initialLogo);
      setPreviewCover(initialCover);
    } else {
      setFormData({
        name: '',
        slug: '',
        city: '',
        department: '',
        address: '',
        description: '',
        latitude: '',
        longitude: '',
        is_active: true,
      });
      setBusinessHours(createDefaultBusinessHours());
      setPreviewLogo(null);
      setPreviewCover(null);
    }

    setCoverImage(null);
    setLogoImage(null);
    setErrors({});
  }, [initialData, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }

    // Clear validation error when typing
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleLogoChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] || null;
    setLogoImage(file);
    if (file) {
      setPreviewLogo(URL.createObjectURL(file));
    } else {
      setPreviewLogo(null);
    }
  };

  const handleCoverChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] || null;
    setCoverImage(file);
    if (file) {
      setPreviewCover(URL.createObjectURL(file));
    } else {
      setPreviewCover(null);
    }
  };

  /** El mapa devuelve números; el formulario los guarda como texto. */
  const handleMapChange = (change: MapPickerChange) => {
    setErrors((prev) => ({ ...prev, latitude: '', longitude: '' }));
    setFormData((prev) => ({
      ...prev,
      latitude: String(change.latitude),
      longitude: String(change.longitude),
      address: change.addressLine || prev.address,
      city: change.municipality || prev.city,
      department: change.department || prev.department,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.address.trim()) {
      // Pibox lo exige para armar la recogida; sin él, `buildBookingPayload`
      // lanza PiboxDataError al despachar.
      newErrors.address = 'La dirección es obligatoria para poder despachar pedidos.';
    }

    const latVal = toCoordinate(formData.latitude);
    const lngVal = toCoordinate(formData.longitude);

    const coordError = validateColombiaCoordinates(latVal, lngVal);
    if (coordError) {
      newErrors.latitude = coordError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const data: Record<string, unknown> = {
      ...formData,
      // A número o `null`, nunca cadena vacía: un `''` llega a Pibox como
      // `Number('') === 0` y manda al mensajero al punto (0,0) sin error.
      // `numeric(10,7)` obliga además a truncar a 7 decimales.
      latitude: latVal !== null ? latVal.toFixed(7) : null,
      longitude: lngVal !== null ? lngVal.toFixed(7) : null,
      business_hours: businessHours,
    };

    const marketplaceId = initialData?.id || crypto.randomUUID();

    if (coverImage) {
      const path = `imgs/${marketplaceId}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`;
      await uploadImageDirect('plazas', path, coverImage);
      data.id = marketplaceId;
      data.cover_image_url = path;
    }

    if (logoImage) {
      const path = `imgs/${marketplaceId}/logo-${Date.now()}.${logoImage.name.split('.').pop()}`;
      await uploadImageDirect('plazas', path, logoImage);
      data.id = marketplaceId;
      data.logo_url = path;
    }

    const success = await onSave(data, initialData?.id);

    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Plaza' : 'Nueva Plaza'}
      maxWidth="max-w-2xl"
      maxHeight="85vh"
    >
      <div className="p-8">
        <form onSubmit={handleSubmit} className="space-y-4 px-1 pr-4">
          {/* Logo + Nombre */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-mm-txs ml-1">
              Logo de la Plaza
            </label>

            <div className="flex gap-4">
              <div className="w-24 h-24 bg-mm-gbg rounded-3xl flex items-center justify-center text-4xl shrink-0 overflow-hidden border-2 border-dashed border-mm-crd group relative">
                {previewLogo ? (
                  <img
                    src={previewLogo}
                    alt="Preview Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <ImageIcon className="w-6 h-6 text-mm-txw" />
                    <span className="text-[10px] text-mm-txw font-bold uppercase">
                      Subir
                    </span>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex-grow space-y-2">
                <Input
                  label="Nombre de la Plaza"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ej: Plaza Minorista"
                  required
                />
              </div>
            </div>
          </div>

          {/* Slug + Departamento */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Identificador"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              placeholder="plaza-minorista"
              required
            />

            <Input
              label="Departamento"
              name="department"
              value={formData.department}
              onChange={handleChange}
              placeholder="Antioquia"
              required
            />
          </div>

          {/* Ciudad + Dirección */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ciudad"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Ej: Medellín"
              required
            />

            <Input
              label="Dirección Exacta"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Ej: Calle 50 # 50-50"
              required
              error={errors.address}
            />
          </div>

          {/* La plaza es el punto de RECOGIDA de todos los pedidos de sus
              tiendas: sin coordenadas, ningún tendero de la plaza puede
              despachar. Antes se tecleaban a mano y dos de las tres plazas
              quedaron sin ellas. */}
          <MapPicker
            latitude={formData.latitude ? Number(formData.latitude) : null}
            longitude={formData.longitude ? Number(formData.longitude) : null}
            onChange={handleMapChange}
            label="Ubicación de la plaza en el mapa"
            helpText="Busca la plaza o marca el punto. Es donde el mensajero recoge los pedidos."
            initialQuery={formData.address}
          />

          {(errors.latitude || errors.longitude) && (
            <p className="ml-1 text-xs font-medium text-r">
              {errors.latitude || errors.longitude}
            </p>
          )}

          {/* Descripción */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-mm-txs ml-1">
              Descripción
            </label>

            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Descripción de la plaza..."
              className="w-full bg-mm-gbg border-none rounded-2xl py-3 px-4 text-mm-g font-medium focus:ring-2 ring-mm-g/20 transition-all outline-none resize-none h-24"
            />
          </div>

          {/* Horario de atención */}
          <WeeklyHoursEditor value={businessHours} onChange={setBusinessHours} />

          {/* Imagen de Portada */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-mm-txs ml-1">
              Imagen de Portada
            </label>

            {previewCover && (
              <div className="w-full h-32 rounded-2xl overflow-hidden border border-mm-crd mb-2 relative">
                <img
                  src={previewCover}
                  alt="Preview Cover"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="w-full bg-mm-gbg border-none rounded-2xl py-2 px-4 text-mm-g font-medium focus:ring-2 ring-mm-g/20 transition-all outline-none"
            />
          </div>

          {/* Is Active */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              id="is_active"
              className="w-4 h-4 text-mm-g bg-mm-gbg border-mm-crd rounded focus:ring-mm-g/20"
            />

            <label
              htmlFor="is_active"
              className="text-sm font-medium text-mm-txs"
            >
              Está activa
            </label>
          </div>

          {/* Botones */}
          <div className="pt-4 flex gap-3 pb-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>

            <Button type="submit" className="flex-1">
              {initialData
                ? 'Guardar Cambios'
                : 'Crear Plaza'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}