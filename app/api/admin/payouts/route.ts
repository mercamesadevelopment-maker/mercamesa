import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { construirBorrador, SinPedidosError } from '@/lib/payouts/build-draft';
import { PayoutConfigError } from '@/lib/payouts/settings';

/**
 * Las liquidaciones de pago a las tiendas.
 *
 * Crear una NO genera el archivo: deja un borrador para revisar. El archivo se
 * produce al aprobarlo, y es lo que se sube al portal del banco.
 */

export async function GET() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(supabase, 'payouts', 'read');
    if (denied) return denied;

    const service = createSupabaseServiceClient();

    const { data, error } = await service
      .from('payouts')
      .select(
        `id, consecutive, file_name, status, scheduled_for, total_amount, items_count,
         file_path, generated_at, approved_at, cancelled_at, notes,
         generado:profiles!payouts_generated_by_fkey ( full_name ),
         aprobado:profiles!payouts_approved_by_fkey ( full_name )`
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('admin/payouts: no se pudieron listar', error);
      return NextResponse.json(
        { error: 'No se pudieron cargar las liquidaciones.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: (data ?? []).map((p: any) => ({
          id: p.id,
          consecutive: p.consecutive,
          fileName: p.file_name,
          status: p.status,
          scheduledFor: p.scheduled_for,
          totalAmount: Number(p.total_amount),
          itemsCount: p.items_count,
          hasFile: !!p.file_path,
          generatedAt: p.generated_at,
          approvedAt: p.approved_at,
          cancelledAt: p.cancelled_at,
          generatedByName: p.generado?.full_name ?? null,
          approvedByName: p.aprobado?.full_name ?? null,
          notes: p.notes,
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'payouts',
      'create',
      'No tienes permisos para generar dispersiones'
    );
    if (denied) return denied;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    const service = createSupabaseServiceClient();
    const borrador = await construirBorrador(service, {
      scheduledFor: body.scheduledFor,
      generatedBy: user.id,
    });

    return NextResponse.json(borrador, { status: 201 });
  } catch (error: unknown) {
    // Falta configuración: no es un fallo, es una tarea pendiente, y el mensaje
    // dice dónde resolverla.
    if (error instanceof PayoutConfigError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof SinPedidosError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
