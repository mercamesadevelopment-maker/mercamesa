import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { generarArchivo } from '@/lib/payouts/generate-file';
import { FlatFileError } from '@/lib/payouts/bbva-flat-file';

/**
 * Aprueba el borrador y genera el archivo para el banco.
 *
 * Es el punto en el que un borrador deja de ser reversible: a partir de acá
 * existe un `.txt` que alguien puede subir al portal y mover dinero de verdad.
 * Por eso el archivo se genera ACÁ y no al armar el borrador — mientras sea
 * borrador, cancelarlo no deja nada suelto.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'payouts',
      'update',
      'No tienes permisos para aprobar dispersiones'
    );
    if (denied) return denied;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const service = createSupabaseServiceClient();

    const { data: payout } = await service
      .from('payouts')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (!payout) {
      return NextResponse.json({ error: 'La liquidación no existe.' }, { status: 404 });
    }

    if (payout.status !== 'draft') {
      return NextResponse.json(
        {
          error:
            payout.status === 'approved'
              ? 'Esta liquidación ya fue aprobada. Descarga el archivo desde el detalle.'
              : 'Esta liquidación fue cancelada y ya no se puede aprobar.',
        },
        { status: 409 }
      );
    }

    // El archivo primero. Si falla —un dato que no cabe, una cuenta BBVA sin
    // oficina— la liquidación sigue siendo borrador y se puede corregir la
    // cuenta y reintentar. Al revés quedaría aprobada sin archivo que subir.
    const archivo = await generarArchivo(service, id);

    const { error: updateError } = await service
      .from('payouts')
      .update({
        status: 'approved',
        file_name: archivo.fileName,
        file_path: archivo.filePath,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      // Por si dos aprobaciones entran a la vez: la segunda no encuentra la fila
      // en 'draft' y no hace nada.
      .eq('status', 'draft');

    if (updateError) {
      console.error('payouts/approve: no se pudo marcar como aprobada', updateError);
      return NextResponse.json(
        { error: 'El archivo se generó pero la liquidación no quedó aprobada. Vuelve a intentarlo.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        approved: true,
        fileName: archivo.fileName,
        storesCount: archivo.storesCount,
        totalAmount: archivo.totalAmount,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // Un error del formato es un dato malo, no una falla del servidor, y el
    // mensaje dice exactamente qué corregir.
    if (error instanceof FlatFileError) {
      return NextResponse.json(
        { error: `No se pudo armar el archivo: ${error.message}` },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
