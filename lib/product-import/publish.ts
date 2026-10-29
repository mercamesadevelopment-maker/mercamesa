import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { PRODUCT_CODE_UNIQUE_INDEX, duplicateProductCodeMessage } from '@/lib/products/product-code';
import { INSERT_CHUNK_SIZE, MAX_ROW_BY_ROW_RETRIES } from './constants';
import type { ImportRowResult, ValidatedNewRow, ValidatedRow } from './types';

type StoreProductInsert = Database['public']['Tables']['store_products']['Insert'];
type CatalogProductInsert = Database['public']['Tables']['catalog_products']['Insert'];

export function toInsert(storeId: string, row: ValidatedRow | ValidatedNewRow): StoreProductInsert {
  return {
    store_id: storeId,
    catalog_product_id: row.catalogProductId,
    code: row.productCode,
    unit_id: row.unitId,
    price_per_unit: row.pricePerUnit,
    stock: row.stock,
    min_order_qty: row.minOrderQty,
    wholesale_price: row.wholesalePrice,
    wholesale_min_qty: row.wholesaleMinQty,
    is_active: true,
  };
}

/**
 * Traduce el error de Postgres a algo accionable. Los 23505 solo pueden ocurrir
 * si algo se publicó entre la validación y la escritura, porque ambos choques ya
 * se detectan antes.
 */
export function insertErrorMessage(
  message: string,
  code: string | undefined,
  row: ValidatedRow | ValidatedNewRow
): string {
  if (code !== '23505') return message;

  if (message.includes(PRODUCT_CODE_UNIQUE_INDEX)) {
    return duplicateProductCodeMessage(row.productCode);
  }

  return 'Ya lo tienes publicado (se publicó mientras se procesaba el archivo).';
}

/**
 * Publica en bloques de `INSERT_CHUNK_SIZE`. El camino normal es un INSERT por
 * bloque; si un bloque falla, se reintenta **solo ese bloque** fila por fila
 * para aislar cuál rompió y publicar el resto.
 *
 * El reintento individual es secuencial, así que se lleva la cuenta: pasado
 * `MAX_ROW_BY_ROW_RETRIES` la carga se detiene y lo que queda se reporta como
 * `not_processed`. Volver a subir el mismo archivo es seguro y es la vía de
 * recuperación: lo ya publicado sale como omitido y solo se escribe lo que
 * falta.
 */
export async function publishRows(
  supabase: SupabaseClient<any>,
  storeId: string,
  valid: ValidatedRow[]
): Promise<ImportRowResult[]> {
  const results: ImportRowResult[] = [];
  let rowByRowCount = 0;

  for (let index = 0; index < valid.length; index += INSERT_CHUNK_SIZE) {
    const chunk = valid.slice(index, index + INSERT_CHUNK_SIZE);

    const { error } = await supabase
      .from('store_products')
      .insert(chunk.map((row) => toInsert(storeId, row)));

    if (!error) {
      results.push(...chunk.map(created));
      continue;
    }

    if (rowByRowCount + chunk.length > MAX_ROW_BY_ROW_RETRIES) {
      results.push(...valid.slice(index).map(notProcessed));
      break;
    }

    for (const row of chunk) {
      const { error: rowError } = await supabase
        .from('store_products')
        .insert(toInsert(storeId, row));

      rowByRowCount++;
      results.push(
        rowError
          ? {
              row: row.row,
              code: row.code,
              name: row.name,
              status: 'failed',
              message: insertErrorMessage(rowError.message, rowError.code, row),
            }
          : created(row)
      );
    }
  }

  return results;
}

export function created(row: ValidatedRow): ImportRowResult {
  return { row: row.row, code: row.code, name: row.name, status: 'created' };
}

export function createdNew(row: ValidatedNewRow): ImportRowResult {
  return { row: row.row, sheet: 'new', code: '', name: row.name, status: 'created' };
}

function toCatalogInsert(storeId: string, userId: string, row: ValidatedNewRow): CatalogProductInsert {
  return {
    id: row.catalogProductId,
    name: row.name,
    slug: row.slug,
    siigo_id: row.siigoId,
    category_id: row.categoryId,
    default_unit_id: row.unitId,
    description: row.description,
    is_active: true,
    // En revisión: solo esta tienda lo ve hasta que el admin lo apruebe.
    review_status: 'pending',
    proposed_by_store_id: storeId,
    owner_group_id: null,
    created_by: userId,
  };
}

/**
 * Productos nuevos: cada uno crea su producto del catálogo, en revisión, y lo
 * publica en la tienda.
 *
 * El catálogo se escribe con el cliente de servicio: el tendero no tiene permiso
 * sobre `catalog_products`, y quien llama ya comprobó que maneja la tienda. Va
 * por bloques, como los del catálogo. Si falla publicar alguno, se borra el
 * producto del catálogo que se acababa de crear para él: sin tienda que lo
 * venda, sería un pendiente huérfano en la revisión del admin.
 */
export async function publishNewRows(
  supabase: SupabaseClient<any>,
  service: SupabaseClient<any>,
  storeId: string,
  userId: string,
  valid: ValidatedNewRow[]
): Promise<ImportRowResult[]> {
  if (valid.length === 0) return [];

  const results: ImportRowResult[] = [];
  let rowByRowCount = 0;

  const failed = (row: ValidatedNewRow, message: string): ImportRowResult => ({
    row: row.row,
    sheet: 'new',
    code: '',
    name: row.name,
    status: 'failed',
    message,
  });

  /** Una fila sola: catálogo, tienda, y deshacer el catálogo si la tienda falla. */
  const writeOne = async (row: ValidatedNewRow): Promise<ImportRowResult> => {
    const { error: catalogError } = await service
      .from('catalog_products')
      .insert(toCatalogInsert(storeId, userId, row));
    if (catalogError) {
      return failed(row, `No se pudo crear el producto: ${catalogError.message}`);
    }
    const { error: storeError } = await supabase.from('store_products').insert(toInsert(storeId, row));
    if (storeError) {
      await service.from('catalog_products').delete().eq('id', row.catalogProductId);
      return failed(row, insertErrorMessage(storeError.message, storeError.code, row));
    }
    return createdNew(row);
  };

  for (let index = 0; index < valid.length; index += INSERT_CHUNK_SIZE) {
    const chunk = valid.slice(index, index + INSERT_CHUNK_SIZE);

    const { error: catalogError } = await service
      .from('catalog_products')
      .insert(chunk.map((row) => toCatalogInsert(storeId, userId, row)));

    if (!catalogError) {
      const { error: storeError } = await supabase
        .from('store_products')
        .insert(chunk.map((row) => toInsert(storeId, row)));

      if (!storeError) {
        results.push(...chunk.map(createdNew));
        continue;
      }

      // El bloque de la tienda falló entero: se deshace el del catálogo y se
      // reintenta fila por fila, como cuando falla el del catálogo.
      await service
        .from('catalog_products')
        .delete()
        .in('id', chunk.map((row) => row.catalogProductId));
    }

    if (rowByRowCount + chunk.length > MAX_ROW_BY_ROW_RETRIES) {
      results.push(...valid.slice(index).map(notProcessedNew));
      break;
    }

    for (const row of chunk) {
      rowByRowCount++;
      results.push(await writeOne(row));
    }
  }

  return results;
}

function notProcessedNew(row: ValidatedNewRow): ImportRowResult {
  return {
    row: row.row,
    sheet: 'new',
    code: '',
    name: row.name,
    status: 'not_processed',
    message: 'La carga se detuvo antes de llegar a este producto. Vuelve a subir el archivo para crearlo.',
  };
}

function notProcessed(row: ValidatedRow): ImportRowResult {
  return {
    row: row.row,
    code: row.code,
    name: row.name,
    status: 'not_processed',
    message: 'La carga se detuvo antes de llegar a este producto. Vuelve a subir el archivo para publicarlo.',
  };
}

