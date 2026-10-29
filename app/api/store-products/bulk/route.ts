import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStore } from '@/lib/auth/can-manage-store';
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_NEW_PRODUCTS,
  SpreadsheetError,
  buildReport,
  loadImportLookups,
  parseSellerWorkbook,
  validateNewRows,
  validateRows,
  type ImportRowResult,
} from '@/lib/product-import';
import { created, createdNew, publishNewRows, publishRows } from '@/lib/product-import/publish';

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

    const written = await publishRows(supabase, storeId, valid);
    // El catálogo se escribe con el cliente de servicio: el tendero no tiene
    // permiso sobre `catalog_products`, y acá ya se comprobó que maneja la tienda.
    const writtenNew = await publishNewRows(supabase, createSupabaseServiceClient(), storeId, user.id, nuevos.valid);

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
