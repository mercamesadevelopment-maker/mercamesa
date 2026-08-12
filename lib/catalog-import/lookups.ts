import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/src/components/Shared';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import type { CatalogLookups, CategoryOption, StoreGroupOption, UnitOption } from './types';

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
}

interface UnitRow {
  id: string;
  name: string;
  abbreviation: string;
}

interface ProductRow {
  name: string;
  slug: string;
  category_id: string | null;
}

/** Clave de comparación: sin tildes, en minúscula y sin espacios repetidos. */
function key(value: string): string {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function addMatch(map: Map<string, string[]>, text: string, id: string) {
  const k = key(text);
  if (!k) return;
  const ids = map.get(k) ?? [];
  if (!ids.includes(id)) ids.push(id);
  map.set(k, ids);
}

/**
 * Carga categorías, unidades y el catálogo existente, todo paginado: PostgREST
 * corta en 1.000 filas sin avisar y el catálogo ya ronda las 634.
 */
export async function loadCatalogLookups(
  supabase: SupabaseClient<any>
): Promise<CatalogLookups> {
  const [categoryRows, unitRows, productRows, groupRows] = await Promise.all([
    fetchAllRows<CategoryRow>((from, to) =>
      supabase
        .from('categories')
        .select('id, name, parent_id')
        .eq('is_active', true)
        .order('id')
        .range(from, to)
    ),
    fetchAllRows<UnitRow>((from, to) =>
      supabase
        .from('measurement_units')
        .select('id, name, abbreviation')
        .eq('is_active', true)
        .order('id')
        .range(from, to)
    ),
    fetchAllRows<ProductRow>((from, to) =>
      supabase.from('catalog_products').select('name, slug, category_id').order('slug').range(from, to)
    ),
    // Los grupos son pocos (uno por comerciante con productos propios), pero se
    // pagina igual por consistencia con el resto.
    fetchAllRows<StoreGroupOption>((from, to) =>
      supabase.from('store_groups').select('id, name').order('name').range(from, to)
    ),
  ]);

  // Sin categorías o sin unidades no hay nada contra qué validar: la plantilla
  // saldría con desplegables vacíos y la carga rechazaría todas las filas
  // diciendo "la categoría no existe". Pasa, por ejemplo, si la sesión no llega
  // al servidor: `categories` y `measurement_units` tienen RLS que solo permite
  // leer a `authenticated`. Mejor fallar de una y con un motivo claro.
  if (categoryRows.length === 0 || unitRows.length === 0) {
    throw new Error(
      'No se pudieron cargar las categorías o las unidades de medida. Vuelve a iniciar sesión e inténtalo de nuevo.'
    );
  }

  // `categories` se auto-referencia por parent_id y PostgREST no resuelve ese
  // embed dentro de sí misma, así que la ruta se arma acá con un mapa.
  const nameById = new Map(categoryRows.map((c) => [c.id, c.name]));
  const pathById = new Map<string, string>();

  const categories: CategoryOption[] = categoryRows
    .map((category) => {
      const parentName = category.parent_id ? nameById.get(category.parent_id) : undefined;
      const path = parentName ? `${parentName} > ${category.name}` : category.name;
      pathById.set(category.id, path);
      return { id: category.id, path };
    })
    .sort((a, b) => a.path.localeCompare(b.path, 'es'));

  // La ruta completa siempre; el nombre suelto solo desambigua si no se repite,
  // y como 10 nombres de categoría se repiten entre padres, esos quedan con más
  // de un id y la validación los rechaza pidiendo la ruta.
  const categoryIdsByText = new Map<string, string[]>();
  for (const category of categories) {
    addMatch(categoryIdsByText, category.path, category.id);
  }
  for (const category of categoryRows) {
    addMatch(categoryIdsByText, category.name, category.id);
  }

  const units: UnitOption[] = unitRows
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      abbreviation: unit.abbreviation,
      label: `${unit.name} (${unit.abbreviation})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));

  // measurement_units no tiene unique en name ni abbreviation: un texto puede
  // resolver a más de una unidad y eso se trata como error, no se elige al azar.
  const unitIdsByText = new Map<string, string[]>();
  for (const unit of units) {
    addMatch(unitIdsByText, unit.label, unit.id);
    addMatch(unitIdsByText, unit.name, unit.id);
    addMatch(unitIdsByText, unit.abbreviation, unit.id);
  }

  // store_groups no tiene unique en name (sí en slug), así que dos grupos podrían
  // llamarse igual; se tratan como ambiguos en vez de elegir uno al azar.
  const storeGroups: StoreGroupOption[] = [...groupRows].sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  );
  const storeGroupIdsByText = new Map<string, string[]>();
  for (const group of storeGroups) {
    addMatch(storeGroupIdsByText, group.name, group.id);
  }

  const existingNames = new Map<string, string>();
  const existingSlugs = new Set<string>();
  for (const product of productRows) {
    existingSlugs.add(product.slug);
    const nameKey = key(product.name);
    if (nameKey && !existingNames.has(nameKey)) {
      existingNames.set(
        nameKey,
        (product.category_id && pathById.get(product.category_id)) || 'sin categoría'
      );
    }
  }

  return {
    categories,
    units,
    storeGroups,
    categoryIdsByText,
    unitIdsByText,
    storeGroupIdsByText,
    existingNames,
    existingSlugs,
  };
}

export { key as normalizeLookupKey };
