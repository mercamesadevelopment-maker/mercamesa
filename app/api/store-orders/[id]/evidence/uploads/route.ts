import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { photoUploadError } from '@/lib/storage/photo-rules';
import { STORE_EVIDENCE_MAX_PHOTOS } from '@/lib/orders/store-evidence-rules';
import { createStoreEvidenceUploadTicket } from '@/lib/orders/store-evidence';

/**
 * Un permiso de subida por cada foto de la evidencia del tendero. El navegador
 * sube directo al bucket privado y manda las rutas con el cambio de estado.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json().catch(() => ({}));
    const files: { type?: unknown; size?: unknown }[] = Array.isArray(body.files) ? body.files : [];
    const error = photoUploadError(files, STORE_EVIDENCE_MAX_PHOTOS);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
    const data = await Promise.all(files.map((f) => createStoreEvidenceUploadTicket(service, user.id, String(f.type))));
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    console.error('[store-orders/evidence/uploads] error no controlado', error);
    return NextResponse.json({ error: 'No pudimos preparar la subida de las fotos.' }, { status: 500 });
  }
}
