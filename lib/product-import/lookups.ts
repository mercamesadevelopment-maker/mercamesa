import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/src/components/Shared';
import { productCodeKey } from '@/lib/products/product-code';
import type { ImportLookups } from './types';

/**
 * Carga en tres consultas todo lo que la validación necesita, para no golpear
 * la base una vez por fila.
 */
export async function loadImportLookups(
  supabase: SupabaseClient<any>,
  storeId: string
): Promise<ImportLookups> {
  const [catalogRes, unitsRes, existingRes] = await Promise.all([
    supabase
      .from('catalog_products')
      .select('id, name, slug, default_unit_id')
      .eq('is_active', true),
    supabase.from('measurement_units').select('id, name, abbreviation').eq('is_active', true),
    supabase.from('store_products').select('catalog_product_id, code').eq('store_id', storeId),
  ]);

  if (catalogRes.error) throw new Error(catalogRes.error.message);
  if (unitsRes.error) throw new Error(unitsRes.error.message);
  if (existingRes.error) throw new Error(existingRes.error.message);

  const catalogBySlug = new Map<string, { id: string; name: string; defaultUnitId: string | null }>();
  for (const product of catalogRes.data ?? []) {
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
  for (const unit of unitsRes.data ?? []) {
    for (const text of [unit.abbreviation, unit.name]) {
      const key = normalizeText(text).trim();
      if (!key) continue;
      const ids = unitIdsByText.get(key) ?? [];
      if (!ids.includes(unit.id)) ids.push(unit.id);
      unitIdsByText.set(key, ids);
    }
  }

  const existingCatalogProductIds = new Set(
    (existingRes.data ?? []).map((row) => row.catalog_product_id)
  );

  const existingProductCodes = new Set(
    (existingRes.data ?? [])
      .map((row) => productCodeKey(row.code))
      .filter((code) => code !== '')
  );

  return { catalogBySlug, unitIdsByText, existingCatalogProductIds, existingProductCodes };
}
