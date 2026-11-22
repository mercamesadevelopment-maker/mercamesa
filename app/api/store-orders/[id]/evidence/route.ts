import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { loadStoreEvidence, storeOrderNeedsEvidence } from '@/lib/orders/store-evidence';

/**
 * Si al marcar «Listo Recogida» le toca al tendero dejar fotos (`required`) y
 * la evidencia que ya dejó. Para el equipo de la tienda y los admins.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    if (!(await canManageStoreOrder(supabase, id, user.id))) {
      return NextResponse.json({ error: 'No tienes permisos sobre este pedido.' }, { status: 403 });
    }

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const [required, evidence] = await Promise.all([storeOrderNeedsEvidence(service, id), loadStoreEvidence(service, id)]);
    return NextResponse.json({ data: { required, evidence } }, { status: 200 });
  } catch (error: unknown) {
    console.error('[store-orders/evidence] error no controlado', error);
    return NextResponse.json({ error: 'No pudimos cargar la evidencia del pedido.' }, { status: 500 });
  }
}
