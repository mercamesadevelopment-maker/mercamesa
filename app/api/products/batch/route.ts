import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { parseMasterBatchBody } from '@/lib/catalog/master-grid';
import { saveMasterBatch } from '@/lib/catalog/save-master-batch';

/**
 * Guarda los cambios de la tabla del catálogo maestro (nombre, categoría,
 * unidad, IVA, exclusividad, activo y descripción) en un solo envío. Exige el
 * mismo permiso que editar un producto: `master-catalog` / `update`.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(
      supabase,
      'master-catalog',
      'update',
      'No tienes permisos para editar productos del catálogo'
    );
    if (denied) return denied;

    const parsed = parseMasterBatchBody(await request.json().catch(() => null));
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await saveMasterBatch(supabase, parsed.rows);
    if (result.status === 'invalid') {
      return NextResponse.json({ error: 'Hay celdas con errores.', errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ saved: result.saved, errors: result.errors }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
