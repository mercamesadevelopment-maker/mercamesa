import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStore } from '@/lib/auth/can-manage-store';
import {
  ACCEPTED_EXTENSIONS,
  INSERT_CHUNK_SIZE,
  MAX_FILE_BYTES,
  MAX_NEW_PRODUCTS,
  MAX_ROW_BY_ROW_RETRIES,
  SpreadsheetError,
  buildReport,
  loadImportLookups,
  parseSellerWorkbook,
  validateNewRows,
  validateRows,
  type ImportRowResult,
  type ValidatedNewRow,
  type ValidatedRow,
} from '@/lib/product-import';
import {
  PRODUCT_CODE_UNIQUE_INDEX,
  duplicateProductCodeMessage,
} from '@/lib/products/product-code';
import type { Database } from '@/types/database_generated';

type StoreProductInsert = Database['public']['Tables']['store_products']['Insert'];
type CatalogProductInsert = Database['public']['Tables']['catalog_products']['Insert'];

/**
 * Publicar un catálogo completo (proyección del cliente: hasta 3.000 productos)
 * son unos pocos segundos: parsear el archivo, tres consultas de referencia y
 * los INSERT por bloques. Se declara el techo explícitamente en vez de heredar
 * el default de la plataforma, que es invisible.
 *
 * Si algún día el trabajo dejara de caber acá —decenas de miles de filas, o una
 * llamada externa por producto, como sincronizar cada uno con Siigo—, ese sería
 * el momento de sacarlo a una cola en segundo plano y no antes.
 */
export const maxDuration = 60;

function toInsert(storeId: string, row: ValidatedRow | ValidatedNewRow): StoreProductInsert {
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
function insertErrorMessage(
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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const storeId = String(formData.get('store_id') ?? '');
    const dryRun = String(formData.get('dry_run') ?? '') === 'true';
    const file = formData.get('file');

    if (!storeId) {
      return NextResponse.json({ error: 'Falta la tienda a la que se va a importar.' }, { status: 400 });
    }

    // store_products no tiene RLS: esta verificación es el control de acceso.
    if (!(await canManageStore(supabase, storeId, user.id))) {
      return NextResponse.json(
        { error: 'No tienes permisos para publicar productos en esta tienda.' },
        { status: 403 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
      return NextResponse.json(
        { error: `El archivo debe ser ${ACCEPTED_EXTENSIONS.join(' o ')}.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `El archivo pesa más de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const [sheets, lookups] = await Promise.all([
      parseSellerWorkbook(buffer, fileName),
      loadImportLookups(supabase, storeId),
    ]);

    // Los códigos de la tienda no se pueden repetir entre las dos hojas.
    const seenProductCodes = new Map<string, string>();
    const { valid, results } = validateRows(sheets.catalog, lookups, seenProductCodes);
    const nuevos = validateNewRows(sheets.newProducts, lookups, seenProductCodes);

    if (nuevos.valid.length > MAX_NEW_PRODUCTS) {
      throw new SpreadsheetError(
        `La hoja "Productos nuevos" trae ${nuevos.valid.length} productos y el máximo por carga es ${MAX_NEW_PRODUCTS}. Divídela en varios archivos.`
      );
    }

    if (dryRun) {
      // Las filas válidas todavía no existen: se anuncian como "created" para
      // que el reporte de la previsualización tenga la misma forma que el real.
      const preview: ImportRowResult[] = [
        ...valid.map(created),
        ...nuevos.valid.map(createdNew),
      ];
      return NextResponse.json(buildReport([...results, ...nuevos.results, ...preview], true), {
        status: 200,
      });
    }

    const written = await insertRows(supabase, storeId, valid);
    const writtenNew = await insertNewRows(supabase, storeId, user.id, nuevos.valid);

    return NextResponse.json(
      buildReport([...results, ...nuevos.results, ...written, ...writtenNew], false),
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof SpreadsheetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error en la carga masiva de productos:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Escribe en bloques de `INSERT_CHUNK_SIZE`. El camino normal es un INSERT por
 * bloque; si un bloque falla, se reintenta **solo ese bloque** fila por fila
 * para aislar cuál rompió y publicar el resto.
 *
 * El reintento individual es secuencial, así que se lleva la cuenta: pasado
 * `MAX_ROW_BY_ROW_RETRIES` la carga se detiene y lo que queda se reporta como
 * `not_processed`. Volver a subir el mismo archivo es seguro y es la vía de
 * recuperación: lo ya publicado sale como omitido y solo se escribe lo que
 * falta.
 */
async function insertRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

function created(row: ValidatedRow): ImportRowResult {
  return { row: row.row, code: row.code, name: row.name, status: 'created' };
}

function createdNew(row: ValidatedNewRow): ImportRowResult {
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
async function insertNewRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  userId: string,
  valid: ValidatedNewRow[]
): Promise<ImportRowResult[]> {
  if (valid.length === 0) return [];

  const service = createSupabaseServiceClient();
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

