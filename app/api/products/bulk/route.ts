import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import {
  SpreadsheetError,
  buildReport,
  loadCatalogLookups,
  parseCatalogSpreadsheet,
  validateCatalogRows,
  type ImportRowResult,
  type ValidatedCatalogRow,
} from '@/lib/catalog-import';
import { ACCEPTED_EXTENSIONS, INSERT_CHUNK_SIZE, MAX_FILE_BYTES, MAX_ROW_BY_ROW_RETRIES } from '@/lib/product-import/constants';
import type { Database } from '@/types/database_generated';

type CatalogProductInsert = Database['public']['Tables']['catalog_products']['Insert'];

export const maxDuration = 60;

const MODULE_KEY = 'system-settings';

function toInsert(row: ValidatedCatalogRow, createdBy: string): CatalogProductInsert {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    siigo_id: row.siigoId,
    category_id: row.categoryId,
    default_unit_id: row.defaultUnitId,
    description: row.description,
    dane_unit_code: row.daneUnitCode,
    dane_unit_name: row.daneUnitName,
    is_ancestral_food: row.isAncestralFood,
    is_medicinal_plant: row.isMedicinalPlant,
    is_non_food: row.isNonFood,
    // Se crean activos y sin imagen: la foto se agrega después editando cada uno.
    is_active: true,
    image_url: null,
    created_by: createdBy,
  };
}

function insertErrorMessage(message: string, code: string | undefined): string {
  if (code === '23505') {
    return 'Ya existe un producto con ese identificador (se creó mientras se procesaba el archivo).';
  }
  return message;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // catalog_products no tiene RLS: esta verificación es el control de acceso.
    const denied = await requirePermission(
      supabase,
      MODULE_KEY,
      'create',
      'No tienes permisos para crear productos del catálogo'
    );
    if (denied) return denied;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const formData = await request.formData();
    const dryRun = String(formData.get('dry_run') ?? '') === 'true';
    const file = formData.get('file');

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
      parseCatalogSpreadsheet(buffer, fileName),
      loadCatalogLookups(supabase),
    ]);

    const { valid, results } = validateCatalogRows(rows, lookups);

    if (dryRun) {
      const preview: ImportRowResult[] = valid.map((row) => ({
        row: row.row,
        code: row.slug,
        name: row.name,
        status: 'created',
      }));
      return NextResponse.json(buildReport([...results, ...preview], true), { status: 200 });
    }

    const written = await insertRows(supabase, valid, user.id);

    return NextResponse.json(buildReport([...results, ...written], false), { status: 200 });
  } catch (error: unknown) {
    if (error instanceof SpreadsheetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error en la carga masiva del catálogo:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Mismo patrón que la carga del vendedor: un INSERT por bloque y, si un bloque
 * falla, reintento fila por fila solo de ese bloque, con tope global para no
 * degenerar en miles de consultas secuenciales.
 */
async function insertRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  valid: ValidatedCatalogRow[],
  createdBy: string
): Promise<ImportRowResult[]> {
  const results: ImportRowResult[] = [];
  let rowByRowCount = 0;

  const created = (row: ValidatedCatalogRow): ImportRowResult => ({
    row: row.row,
    code: row.slug,
    name: row.name,
    status: 'created',
  });

  for (let index = 0; index < valid.length; index += INSERT_CHUNK_SIZE) {
    const chunk = valid.slice(index, index + INSERT_CHUNK_SIZE);

    const { error } = await supabase
      .from('catalog_products')
      .insert(chunk.map((row) => toInsert(row, createdBy)));

    if (!error) {
      results.push(...chunk.map(created));
      continue;
    }

    if (rowByRowCount + chunk.length > MAX_ROW_BY_ROW_RETRIES) {
      results.push(
        ...valid.slice(index).map((row) => ({
          row: row.row,
          code: row.slug,
          name: row.name,
          status: 'not_processed' as const,
          message: 'La carga se detuvo antes de llegar a este producto. Vuelve a subir el archivo.',
        }))
      );
      break;
    }

    for (const row of chunk) {
      const { error: rowError } = await supabase
        .from('catalog_products')
        .insert(toInsert(row, createdBy));

      rowByRowCount++;
      results.push(
        rowError
          ? {
              row: row.row,
              code: row.slug,
              name: row.name,
              status: 'failed',
              message: insertErrorMessage(rowError.message, rowError.code),
            }
          : created(row)
      );
    }
  }

  return results;
}
