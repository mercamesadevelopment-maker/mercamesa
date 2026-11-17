import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parsePriceBatchBody } from '@/lib/store-products/price-grid';
import { savePriceBatch } from '@/lib/store-products/save-price-batch';

/**
 * Guarda los cambios de la tabla de productos del tendero (precio, mayorista,
 * mínimo mayorista, stock y publicado) en un solo envío.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = parsePriceBatchBody(await request.json().catch(() => null));
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await savePriceBatch(supabase, user.id, parsed.rows);
    if (result.status === 'forbidden') return NextResponse.json({ error: result.message }, { status: 403 });
    if (result.status === 'invalid') {
      return NextResponse.json({ error: 'Hay celdas con errores.', errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ saved: result.saved, errors: result.errors }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
