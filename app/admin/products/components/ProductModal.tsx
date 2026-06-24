import React, { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { Database } from '../../../../types/database_generated';

type Product = Database['public']['Tables']['catalog_products']['Row'] & {
  imageSignedUrl?: string | null;
};
type Category = Database['public']['Tables']['categories']['Row'];
type Unit = Database['public']['Tables']['measurement_units']['Row'];

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, data: FormData) => Promise<void>;
  initialData: Product | null;
}

export function ProductModal({ isOpen, onClose, onSave, initialData }: ProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [formData, setFormData] = useState({
    name: '', slug: '', category_id: '', default_unit_id: '', description: '',
    is_active: true, is_ancestral_food: false, is_medicinal_plant: false, is_non_food: false
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/categories').then(res => res.json()).then(data => { if (data.data) setCategories(data.data); });
    fetch('/api/measurement-units').then(res => res.json()).then(data => { if (data.data) setUnits(data.data); });
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        slug: initialData.slug || '',
        category_id: initialData.category_id || '',
        default_unit_id: initialData.default_unit_id || '',
        description: initialData.description || '',
        is_active: initialData.is_active,
        is_ancestral_food: initialData.is_ancestral_food,
        is_medicinal_plant: initialData.is_medicinal_plant,
        is_non_food: initialData.is_non_food,
      });
      setImagePreview(initialData.imageSignedUrl || null);
    } else {
      setFormData({
        name: '', slug: '', category_id: '', default_unit_id: '', description: '',
        is_active: true, is_ancestral_food: false, is_medicinal_plant: false, is_non_food: false
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [initialData]);

  useEffect(() => {
    if (!initialData && formData.name) {
      setFormData(prev => ({
        ...prev,
        slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      }));
    }
  }, [formData.name, initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData = new FormData();
      Object.entries(formData).forEach(([k, v]) => submitData.append(k, v.toString()));
      if (imageFile) submitData.append('image', imageFile);
      await onSave(initialData?.id || null, submitData);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Editar Producto' : 'Nuevo Producto'}>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {/* Imagen */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-mm-txs ml-1">Imagen del Producto</label>
          <div className="flex gap-4 items-center">
            <div className="w-24 h-24 bg-mm-gbg rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-2 border-dashed border-mm-crd relative">
              {imagePreview
                ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                : <div className="flex flex-col items-center gap-1">
                    <ImageIcon className="w-6 h-6 text-mm-txw" />
                    <span className="text-[10px] text-mm-txw font-bold uppercase">Subir</span>
                  </div>
              }
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            <p className="text-xs text-mm-txw max-w-[200px]">Sube una imagen cuadrada (1:1). Máximo 2MB.</p>
          </div>
        </div>

        {/* Nombre + Slug */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Nombre del Producto" name="name" value={formData.name} onChange={handleChange} required placeholder="Ej: Tomate Chonto" />
          <Input label="Slug (URL)" name="slug" value={formData.slug} onChange={handleChange} required placeholder="tomate-chonto" />
        </div>

        {/* Categoría + Unidad */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-mm-txs ml-1">Categoría</label>
            <select name="category_id" value={formData.category_id} onChange={handleChange} required
              className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
              <option value="">Selecciona una categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-mm-txs ml-1">Unidad por Defecto</label>
            <select name="default_unit_id" value={formData.default_unit_id} onChange={handleChange} required
              className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none transition-all text-sm">
              <option value="">Selecciona una unidad</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-mm-txs ml-1">Descripción</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Descripción del producto..."
            className="w-full bg-mm-gbg border-none rounded-2xl py-3 px-4 text-mm-g font-medium focus:ring-2 ring-mm-g/20 transition-all outline-none resize-none h-24"
          />
        </div>

        {/* Checkboxes (Atributos) */}
        <div className="grid sm:grid-cols-2 gap-4 bg-mm-gbg/50 p-4 rounded-2xl border border-mm-crd">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
            <label htmlFor="is_active" className="text-sm font-medium text-mm-txs">Producto Activo</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_ancestral_food" name="is_ancestral_food" checked={formData.is_ancestral_food} onChange={handleChange} className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
            <label htmlFor="is_ancestral_food" className="text-sm font-medium text-mm-txs">Alimento Ancestral</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_medicinal_plant" name="is_medicinal_plant" checked={formData.is_medicinal_plant} onChange={handleChange} className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
            <label htmlFor="is_medicinal_plant" className="text-sm font-medium text-mm-txs">Planta Medicinal</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_non_food" name="is_non_food" checked={formData.is_non_food} onChange={handleChange} className="w-4 h-4 rounded border-mm-crd text-mm-g focus:ring-mm-g" />
            <label htmlFor="is_non_food" className="text-sm font-medium text-mm-txs">No es alimento</label>
          </div>
        </div>

        {/* Botones */}
        <div className="pt-2 flex gap-3 pb-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {initialData ? 'Guardar Cambios' : 'Crear Producto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
