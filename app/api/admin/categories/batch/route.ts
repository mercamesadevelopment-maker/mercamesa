import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { batchNeeds, saveCategoryBatch } from '@/lib/categories/save-batch';

/** Las filas que llegan de una vez. Son unas 250 categorías: más que esto es un error. */
const MAX_FILAS = 1000;

/**
 * Guarda de una vez lo que se editó en la tabla de categorías (Parametrización
 * → Categorías): filas nuevas y cambiadas, todo o nada.
 * La regla vive en `lib/categories/save-batch.ts`.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const filas = Array.isArray(body.rows) ? body.rows : null;

    if (!filas || filas.length === 0) {
      return NextResponse.json({ error: 'No llegó ningún cambio.' }, { status: 400 });
    }
    if (filas.length > MAX_FILAS) {
      return NextResponse.json({ error: `Son demasiadas filas de una vez (máximo ${MAX_FILAS}).` }, { status: 400 });
    }

    const necesita = batchNeeds(filas);
    if (necesita.create) {
      const denied = await requirePermission(supabase, 'system-settings', 'create', 'No tienes permisos para crear categorías');
      if (denied) return denied;
    }
    if (necesita.update) {
      const denied = await requirePermission(supabase, 'system-settings', 'update', 'No tienes permisos para editar categorías');
      if (denied) return denied;
    }

    const result = await saveCategoryBatch(supabase, filas);
    if ('message' in result) {
      return NextResponse.json({ error: result.message, errors: result.errors }, { status: result.status });
    }

    return NextResponse.json({ created: result.created, saved: result.saved }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
