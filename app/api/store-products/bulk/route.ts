import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canManageStore } from '@/lib/auth/can-manage-store';
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  SpreadsheetError,
  loadImportLookups,
  parseSpreadsheet,
  validateRows,
  type ImportReport,
  type ImportRowResult,
  type ValidatedRow,
} from '@/lib/product-import';
import type { Database } from '@/types/database_generated';

type StoreProductInsert = Database['public']['Tables']['store_products']['Insert'];

function toInsert(storeId: string, row: ValidatedRow): StoreProductInsert {
  return {
    store_id: storeId,
    catalog_product_id: row.catalogProductId,
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
 * Traduce el error de Postgres a algo accionable. El 23505 es el unique
 * (store_id, catalog_product_id): significa que el producto se publicó entre la
 * validación y la escritura.
 */
function insertErrorMessage(message: string, code?: string): string {
  if (code === '23505') return 'Ya lo tienes publicado (se publicó mientras se procesaba el archivo).';
  return message;
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

    const [rows, lookups] = await Promise.all([
      parseSpreadsheet(buffer, fileName),
      loadImportLookups(supabase, storeId),
    ]);

    const { valid, results } = validateRows(rows, lookups);

    if (dryRun) {
      // Las filas válidas todavía no existen: se anuncian como "created" para
      // que el reporte de la previsualización tenga la misma forma que el real.
      const preview: ImportRowResult[] = valid.map((row) => ({
        row: row.row,
        code: row.code,
        name: row.name,
        status: 'created',
      }));
      return NextResponse.json(buildReport([...results, ...preview], true), { status: 200 });
    }

    const written = await insertRows(supabase, storeId, valid);

    return NextResponse.json(buildReport([...results, ...written], false), { status: 200 });
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
 * Intenta un solo insert con todo (el camino normal, una consulta) y, si algo
 * falla, reintenta fila por fila para publicar lo que sí se pueda y poder decir
 * exactamente cuál falló.
 */
async function insertRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  valid: ValidatedRow[]
): Promise<ImportRowResult[]> {
  if (valid.length === 0) return [];

  const { error } = await supabase
    .from('store_products')
    .insert(valid.map((row) => toInsert(storeId, row)));

  if (!error) {
    return valid.map((row) => ({
      row: row.row,
      code: row.code,
      name: row.name,
      status: 'created' as const,
    }));
  }

  const results: ImportRowResult[] = [];
  for (const row of valid) {
    const { error: rowError } = await supabase
      .from('store_products')
      .insert(toInsert(storeId, row));

    results.push({
      row: row.row,
      code: row.code,
      name: row.name,
      status: rowError ? 'failed' : 'created',
      message: rowError ? insertErrorMessage(rowError.message, rowError.code) : undefined,
    });
  }

  return results;
}

function buildReport(rows: ImportRowResult[], dryRun: boolean): ImportReport {
  const ordered = [...rows].sort((a, b) => a.row - b.row);

  return {
    dryRun,
    rows: ordered,
    summary: {
      total: ordered.length,
      created: ordered.filter((row) => row.status === 'created').length,
      skipped: ordered.filter((row) => row.status === 'skipped').length,
      failed: ordered.filter((row) => row.status === 'failed').length,
    },
  };
}
