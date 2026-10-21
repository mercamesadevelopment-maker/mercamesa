import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Revisión de un producto que propuso un tendero desde la carga masiva
 * (`review_status = 'pending'`).
 *
 * - `{ action: 'approve' }`: pasa al catálogo. Queda público, salvo que el admin
 *   lo haya marcado antes como exclusivo de un grupo al editarlo.
 * - `{ action: 'merge', target_id }`: ya existía con otro nombre. Las tiendas
 *   que lo vendían pasan a vender el existente y el propuesto se borra
 *   (`merge_catalog_product`, en una transacción).
 *
 * Con el cliente de servicio después de exigir el permiso del catálogo maestro:
 * la función de unir no la puede llamar nadie con sesión.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const denied = await requirePermission(
      supabase,
      'master-catalog',
      'update',
      'No tienes permisos para revisar productos del catálogo'
    );
    if (denied) return denied;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const service = createSupabaseServiceClient();

    if (body.action === 'approve') {
      const { data, error } = await service
        .from('catalog_products')
        .update({ review_status: 'approved' })
        .eq('id', id)
        .eq('review_status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) {
        return NextResponse.json({ error: 'El producto ya no está en revisión.' }, { status: 409 });
      }
      return NextResponse.json({ approved: true }, { status: 200 });
    }

    if (body.action === 'merge') {
      const targetId = String(body.target_id ?? '');
      if (!targetId) {
        return NextResponse.json({ error: 'Elige el producto con el que se une.' }, { status: 400 });
      }

      const { data: moved, error } = await service.rpc('merge_catalog_product', {
        p_pending: id,
        p_target: targetId,
      });

      // Los `raise exception` de la función ya traen el motivo para el admin.
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ merged: true, storeProductsMoved: moved }, { status: 200 });
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
