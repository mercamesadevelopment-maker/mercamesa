import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { PAYOUTS_BUCKET } from '@/lib/payouts/generate-file';

/**
 * Descarga el archivo de una liquidación aprobada.
 *
 * El bucket es privado, así que no hay URL pública ni firmada que repartir: el
 * archivo se lee con la llave de servicio y se entrega solo después de
 * comprobar el permiso. Un enlace firmado seguiría sirviendo aunque a la persona
 * le quiten el acceso, y esto es la orden de pago a terceros.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(supabase, 'payouts', 'read');
    if (denied) return denied;

    const service = createSupabaseServiceClient();

    const { data: payout } = await service
      .from('payouts')
      .select('file_name, file_path, status')
      .eq('id', id)
      .maybeSingle();

    if (!payout?.file_path) {
      return NextResponse.json(
        { error: 'Esta liquidación todavía no tiene archivo. Apruébala primero.' },
        { status: 404 }
      );
    }

    const { data: blob, error } = await service.storage
      .from(PAYOUTS_BUCKET)
      .download(payout.file_path);

    if (error || !blob) {
      console.error('payouts/file: no se pudo leer', error?.message);
      return NextResponse.json({ error: 'No se pudo leer el archivo.' }, { status: 500 });
    }

    const contenido = await blob.text();

    return new NextResponse(contenido, {
      status: 200,
      headers: {
        // ASCII puro, que es lo que espera el portal del banco.
        'Content-Type': 'text/plain; charset=us-ascii',
        'Content-Disposition': `attachment; filename="${payout.file_name}"`,
        // Es una orden de pago: no debe quedar en ninguna caché intermedia.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
