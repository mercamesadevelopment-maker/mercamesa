/**
 * Elegir categoría en dos pasos: primero la categoría (madre) y después su
 * subcategoría. Un producto cuelga de una subcategoría; solo cuelga directo de
 * la madre cuando esa madre no tiene subcategorías.
 */

export interface PickerCategory {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface CategoryChoice {
  parentId: string;
  subId: string;
}

const porNombre = (a: PickerCategory, b: PickerCategory) => a.name.localeCompare(b.name, 'es');

/** Las categorías madre, en orden alfabético. */
export function parentCategories(categories: PickerCategory[]): PickerCategory[] {
  return categories.filter((c) => !c.parent_id).sort(porNombre);
}

/** Las subcategorías de una madre, en orden alfabético. */
export function subcategoriesOf(categories: PickerCategory[], parentId: string): PickerCategory[] {
  if (!parentId) return [];
  return categories.filter((c) => c.parent_id === parentId).sort(porNombre);
}

/** De la categoría guardada de un producto, la madre y la sub para los dos selectores. */
export function splitCategory(categories: PickerCategory[], categoryId: string | null | undefined): CategoryChoice {
  const c = categoryId ? categories.find((x) => x.id === categoryId) : undefined;
  if (!c) return { parentId: '', subId: '' };
  return c.parent_id ? { parentId: c.parent_id, subId: c.id } : { parentId: c.id, subId: '' };
}

/**
 * La categoría que se guarda: la sub, o la madre si no tiene subcategorías.
 * `null` si falta elegir (sin madre, o una madre con subs sin elegir la sub).
 */
export function resolveCategory(categories: PickerCategory[], choice: CategoryChoice): string | null {
  if (!choice.parentId) return null;
  const subs = subcategoriesOf(categories, choice.parentId);
  if (subs.length === 0) return choice.parentId;
  return subs.some((s) => s.id === choice.subId) ? choice.subId : null;
}

/**
 * Las categorías donde puede ir un producto, para una sola lista: las
 * subcategorías y las madres sin subcategorías, como «Madre › Sub», en orden.
 */
export function leafCategoryOptions(categories: PickerCategory[]): { id: string; name: string; label: string }[] {
  const conHijas = new Set(categories.map((c) => c.parent_id).filter(Boolean));
  const nombre = new Map(categories.map((c) => [c.id, c.name]));
  return categories
    .filter((c) => !conHijas.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      label: c.parent_id ? `${nombre.get(c.parent_id) ?? ''} › ${c.name}` : c.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/**
 * Las opciones de un filtro por categoría: todas, como «Madre > Sub», en orden.
 * Elegir una madre filtra también sus subcategorías (`categoryWithDescendants`).
 */
export function categoryFilterOptions(categories: PickerCategory[]): { id: string; displayName: string }[] {
  const nombre = new Map(categories.map((c) => [c.id, c.name]));
  return categories
    .map((c) => ({
      id: c.id,
      displayName: c.parent_id ? `${nombre.get(c.parent_id) ?? ''} > ${c.name}` : c.name,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
}

/** La categoría y todas sus descendientes, para filtrar. Vacío si no hay ninguna elegida. */
export function categoryWithDescendants(categories: PickerCategory[], categoryId: string): string[] {
  if (!categoryId) return [];
  const result = [categoryId];
  for (let i = 0; i < result.length; i++) {
    for (const c of categories) {
      if (c.parent_id === result[i] && !result.includes(c.id)) result.push(c.id);
    }
  }
  return result;
}

/** «Madre › Sub» de la categoría de un producto, o la madre sola. Vacío si no se conoce. */
export function categoryLabel(categories: PickerCategory[], categoryId: string | null | undefined): string {
  const c = categoryId ? categories.find((x) => x.id === categoryId) : undefined;
  if (!c) return '';
  const madre = c.parent_id ? categories.find((x) => x.id === c.parent_id) : undefined;
  return madre ? `${madre.name} › ${c.name}` : c.name;
}
