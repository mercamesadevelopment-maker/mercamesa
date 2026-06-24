import React, { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { Database } from '../../../../types/database_generated';

type Store = Database['public']['Tables']['stores']['Row'] & {
  coverSignedUrl?: string | null;
  logoSignedUrl?: string | null;
};
type Marketplace = Database['public']['Tables']['marketplaces']['Row'];

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: FormData) => Promise<void>;
  initialData: Store | null;
}

export function StoreModal({ isOpen, onClose, onSave, initialData }: StoreModalProps) {
  const [loading, setLoading] = useState(false);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [formData, setFormData] = useState({
    name: '', slug: '', marketplace_id: '', description: '',
    contact_name: '', contact_email: '', phone: '', whatsapp: '', is_active: true,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/marketplaces')
      .then(res => res.json())
      .then(data => { if (data.data) setMarketplaces(data.data); });
  }, []);

  useEffect(() => {
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
      setLogoPreview(initialData.logoSignedUrl || null);
    } else {
      setFormData({
        name: '', slug: '',
        marketplace_id: marketplaces.length > 0 ? marketplaces[0].id : '',
        description: '', contact_name: '', contact_email: '',
        phone: '', whatsapp: '', is_active: true,
      });
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
    setLoading(true);
    try {
      const submitData = new FormData();
      Object.entries(formData).forEach(([k, v]) => submitData.append(k, v.toString()));
      if (logoFile) submitData.append('logo', logoFile);
      await onSave(initialData?.id || null, submitData);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al guardar la tienda');
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

        {/* Marketplace */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-mm-txs ml-1">Plaza (Marketplace)</label>
          <select name="marketplace_id" value={formData.marketplace_id} onChange={handleChange} required
            className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
            <option value="">Selecciona una plaza</option>
            {marketplaces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Descripción */}
        <Input label="Descripción" name="description" value={formData.description} onChange={handleChange} placeholder="Breve descripción de la tienda" />

        {/* Contacto */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Nombre de Contacto" name="contact_name" value={formData.contact_name} onChange={handleChange} placeholder="Ej: José Pérez" />
          <Input label="Correo de Contacto" name="contact_email" type="email" value={formData.contact_email} onChange={handleChange} placeholder="tienda@correo.com" />
        </div>

        {/* Teléfono + WhatsApp */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} placeholder="+57 300 000 0000" />
          <Input label="WhatsApp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="+573000000000" />
        </div>

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