import React from 'react';
import { Select } from '@/components/ui/form-fields';
import { parentCategories, subcategoriesOf, type CategoryChoice, type PickerCategory } from '@/lib/categories/picker';

interface CategoryPickerProps {
  categories: PickerCategory[];
  value: CategoryChoice;
  onChange: (value: CategoryChoice) => void;
  error?: string;
}

/** Categoría y subcategoría, en dos listas: la segunda depende de la primera. */
export function CategoryPicker({ categories, value, onChange, error }: CategoryPickerProps) {
  const madres = parentCategories(categories);
  const subs = subcategoriesOf(categories, value.parentId);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        label="Categoría"
        value={value.parentId}
        onChange={(e) => onChange({ parentId: e.target.value, subId: '' })}
        className="text-sm"
      >
        <option value="">Selecciona una categoría</option>
        {madres.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        label="Subcategoría"
        value={value.subId}
        onChange={(e) => onChange({ ...value, subId: e.target.value })}
        disabled={subs.length === 0}
        error={error}
        className="text-sm disabled:opacity-50"
      >
        <option value="">{subs.length === 0 ? 'Sin subcategorías' : 'Selecciona una subcategoría'}</option>
        {subs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
