import { NextResponse } from 'next/server';
import { createClient } from '../../../../../../lib/supabase/server';

/**
 * Histórico de un documento de la tienda: cada versión subida y cada decisión.
 *
 * Quién puede verlo lo resuelve la RLS de `store_document_events` —miembro de la
 * tienda, o quien tenga `stores:read` (admin y superadmin)—, así que acá no hace
 * falta repetir la comprobación: a quien no le corresponda le llega la lista
 * vacía.
 *
 * Se consulta por documento y no de una sola vez al abrir el modal: firmar una
 * URL por cada versión de cada documento sería caro y casi siempre inútil,
 * porque el historial solo se mira cuando alguien lo despliega.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storeId } = await params;
    const { searchParams } = new URL(request.url);
    const documentTypeId = searchParams.get('document_type_id');

    if (!documentTypeId) {
      return NextResponse.json({ error: 'Falta indicar el tipo de documento.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: events, error } = await supabase
      .from('store_document_events')
      .select('id, event_type, file_url, status, previous_status, created_at, profiles:actor_id ( full_name, email )')
      .eq('store_id', storeId)
      .eq('document_type_id', documentTypeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error leyendo el historial de documentos:', error.message);
      return NextResponse.json(
        { error: 'No se pudo cargar el historial del documento.' },
        { status: 400 }
      );
    }

    // Una URL firmada por evento, para poder abrir la versión de entonces y no
    // solo la vigente. El archivo viejo sigue en Storage: reemplazar nunca lo
    // borró, y ahora además se conserva a propósito.
    const withUrls = await Promise.all(
      (events || []).map(async (e) => {
        const { data: signed } = await supabase.storage
          .from('store-documents')
          .createSignedUrl(e.file_url, 3600);

        const actor = e.profiles as { full_name: string | null; email: string | null } | null;

        return {
          id: e.id,
          eventType: e.event_type as 'upload' | 'status_change',
          status: e.status as 'pending' | 'approved' | 'rejected',
          previousStatus: e.previous_status as 'pending' | 'approved' | 'rejected' | null,
          createdAt: e.created_at,
          // Los documentos que ya existían antes del histórico no tienen autor:
          // no hay forma de saber quién los subió e inventarlo sería peor.
          actorName: actor?.full_name || actor?.email || null,
          signedUrl: signed?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ data: withUrls }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
