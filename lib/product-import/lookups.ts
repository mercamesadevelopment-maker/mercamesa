import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/src/components/Shared';
import { productCodeKey } from '@/lib/products/product-code';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { canStoreUseCatalogProduct, getStoreGroupId } from '@/lib/catalog/visibility';
import type { CatalogEntry, ImportLookups } from './types';

interface CatalogRow {
  id: string;
  name: string;
  slug: string;
  default_unit_id: string | null;
  owner_group_id: string | null;
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
  const [storeGroupId, catalog, units, published] = await Promise.all([
    getStoreGroupId(supabase, storeId),
    // Se carga el catálogo completo, no solo el visible: así una fila con el
    // slug de un producto ajeno se rechaza diciendo que es exclusivo de otra
    // tienda, en vez del engañoso "no existe en el catálogo".
    fetchAllRows<CatalogRow>((from, to) =>
      supabase
        .from('catalog_products')
        .select('id, name, slug, default_unit_id, owner_group_id')
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

  const catalogBySlug = new Map<string, CatalogEntry>();
  for (const product of catalog) {
    catalogBySlug.set(normalizeText(product.slug).trim(), {
      id: product.id,
      name: product.name,
      defaultUnitId: product.default_unit_id,
      usable: canStoreUseCatalogProduct(product.owner_group_id, storeGroupId),
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
    // Tope de filas por carga: detecta un archivo duplicado o alterado, y por eso
    // cuenta el catálogo activo completo y no solo lo que la tienda puede
    // publicar. Si contara los visibles, un archivo legítimo que traiga una fila
    // de un producto exclusivo de otra tienda se rechazaría entero, en vez de
    // publicar el resto y reportar esa fila, que es lo que debe pasar.
    catalogSize: catalog.length,
  };
}
