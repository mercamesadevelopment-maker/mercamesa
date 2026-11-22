import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { canManageStoreOrder } from '@/lib/pibox/authz';
import { changeStoreOrderStatus, StoreOrderStatusError } from '@/lib/orders/change-store-order-status';
import { isPlatformAdmin } from '@/lib/auth/can-manage-store';
import { checkTransition } from '@/lib/orders/status-transitions';
import { parseStoreEvidenceInput, STORE_EVIDENCE_REQUIRED_MESSAGE } from '@/lib/orders/store-evidence-rules';
import { saveStoreEvidence, storeOrderNeedsEvidence } from '@/lib/orders/store-evidence';
import { areOwnUploads, FOTO_NO_VALIDA } from '@/lib/storage/private-photos';

const NOTES_MAX = 500;

/**
 * El botón del pedido en el panel de la tienda y del admin: avanza la parte al
 * siguiente estado (ver `lib/orders/status-transitions.ts`) y lo deja en el
 * historial.
 *
 * Antes lo escribía el navegador directo en la base, y la base no tenía cómo
 * impedir que alguien cambiara el pedido de otra tienda. Pedir el mensajero al
 * quedar «Listo Recogida» sigue siendo una llamada aparte a `/api/pibox/bookings`.
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
    const target = typeof body.status === 'string' ? body.status : '';
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, NOTES_MAX) : null;
    if (!target) return NextResponse.json({ error: 'Falta el estado.' }, { status: 400 });

    const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;

    // «Listo Recogida» con evidencia del tendero: cuando la parte no la va a
    // recibir logística, sin al menos una foto no avanza
    // (`lib/orders/store-evidence-rules.ts`). Solo al avanzar: la nota que deja
    // un fallo del domicilio sobre una parte ya lista no pide fotos.
    // El admin puede destrabar un pedido sin foto. Carolina (MCP) llama a
    // `changeStoreOrderStatus` directo y todavía no pide fotos.
    if (target === 'at_collection') {
      const evidencia = parseStoreEvidenceInput(body);
      if ('error' in evidencia) return NextResponse.json({ error: evidencia.error }, { status: 400 });
      const { data: parte } = await service.from('store_orders').select('status').eq('id', id).maybeSingle();
      // Solo si el paso es válido: un paso inválido lo rechaza abajo `changeStoreOrderStatus`, sin guardar fotos.
      const avanza = parte && checkTransition(parte.status, target).kind === 'advance';

      if (avanza && (await storeOrderNeedsEvidence(service, id))) {
        const { photos } = evidencia.input;
        if (photos.length === 0 && !(await isPlatformAdmin(supabase, user.id))) {
          return NextResponse.json({ error: STORE_EVIDENCE_REQUIRED_MESSAGE, code: 'evidence_required' }, { status: 400 });
        }
        if (!areOwnUploads(user.id, photos)) return NextResponse.json({ error: FOTO_NO_VALIDA }, { status: 400 });
        if (photos.length > 0) {
          await saveStoreEvidence(service, { storeOrderId: id, userId: user.id, input: evidencia.input });
        }
      }
    }

    const data = await changeStoreOrderStatus(service, { storeOrderId: id, target, notes, actorId: user.id });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof StoreOrderStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('store-orders/status:', error);
    return NextResponse.json({ error: 'No se pudo cambiar el estado del pedido.' }, { status: 500 });
  }
}
