import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/src/components/Shared';
import { productCodeKey } from '@/lib/products/product-code';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import type { ImportLookups } from './types';

interface CatalogRow {
  id: string;
  name: string;
  slug: string;
  default_unit_id: string | null;
}

interface UnitRow {
  id: string;
  name: string;
  abbreviation: string;
}

interface PublishedRow {
  catalog_product_id: string;
  code: string | null;
}

/**
 * Carga en tres consultas todo lo que la validación necesita, para no golpear
 * la base una vez por fila.
 *
 * Las tres van paginadas: el catálogo y los productos de una tienda pueden pasar
 * de las 1.000 filas que PostgREST devuelve por defecto, y quedarse corto acá se
 * traduce en filas válidas rechazadas por "no existe en el catálogo" o en
 * choques de unique que deberían haberse reportado como ya publicados.
 */
export async function loadImportLookups(
  supabase: SupabaseClient<any>,
  storeId: string
): Promise<ImportLookups> {
  const [catalog, units, published] = await Promise.all([
    fetchAllRows<CatalogRow>((from, to) =>
      supabase
        .from('catalog_products')
        .select('id, name, slug, default_unit_id')
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
    fetchAllRows<PublishedRow>((from, to) =>
      supabase
        .from('store_products')
        .select('catalog_product_id, code')
        .eq('store_id', storeId)
        .order('catalog_product_id')
        .range(from, to)
    ),
  ]);

  const catalogBySlug = new Map<string, { id: string; name: string; defaultUnitId: string | null }>();
  for (const product of catalog) {
    catalogBySlug.set(normalizeText(product.slug).trim(), {
      id: product.id,
      name: product.name,
      defaultUnitId: product.default_unit_id,
    });
  }

  // measurement_units no tiene unique en name ni abbreviation, así que un texto
  // puede resolver a más de una unidad; se guardan todas y la validación trata
  // la ambigüedad como error en vez de elegir una al azar.
  const unitIdsByText = new Map<string, string[]>();
  for (const unit of units) {
    for (const text of [unit.abbreviation, unit.name]) {
      const key = normalizeText(text).trim();
      if (!key) continue;
      const ids = unitIdsByText.get(key) ?? [];
      if (!ids.includes(unit.id)) ids.push(unit.id);
      unitIdsByText.set(key, ids);
    }
  }

  const existingCatalogProductIds = new Set(published.map((row) => row.catalog_product_id));

  const existingProductCodes = new Set(
    published.map((row) => productCodeKey(row.code)).filter((code) => code !== '')
  );

  return {
    catalogBySlug,
    unitIdsByText,
    existingCatalogProductIds,
    existingProductCodes,
    // El tope de filas por carga: nadie puede publicar más productos de los que
    // existen en el catálogo.
    catalogSize: catalog.length,
  };
}
