import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { FlatFileError } from '@/lib/payouts/bbva-flat-file';
import { RegenerarError, regenerarArchivo } from '@/lib/payouts/regenerate-file';

/**
 * Vuelve a generar el archivo de una liquidación aprobada con la cuenta
 * verificada vigente de cada tienda (`lib/payouts/regenerate-file.ts`).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(supabase, 'payouts', 'update', 'No tienes permisos para regenerar el archivo');
    if (denied) return denied;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const r = await regenerarArchivo(createSupabaseServiceClient(), id, user.id);
    return NextResponse.json(
      {
        fileName: r.fileName,
        storesCount: r.storesCount,
        totalAmount: r.totalAmount,
        cuentasCambiadas: r.cuentasCambiadas,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof RegenerarError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof FlatFileError) {
      return NextResponse.json({ error: `No se pudo armar el archivo: ${error.message}` }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
