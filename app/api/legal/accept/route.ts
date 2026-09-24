import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentLegalDocuments } from '@/lib/legal/current-documents';
import { getClientIp } from '@/lib/auth/verification-codes';

/**
 * Registra que esta persona aceptó los documentos **vigentes**.
 *
 * El cliente no manda qué aceptó: lo resuelve el servidor. Si lo mandara, una
 * petición hecha a mano podría dejar constancia de haber aceptado una versión
 * vieja —o una inexistente— y la constancia dejaría de valer, que es lo único
 * para lo que existe.
 *
 * Acá está la comprobación de verdad. La pantalla bloqueante del shell es la
 * forma de llegar hasta esta ruta, no la protección: quien la esquive con las
 * herramientas del navegador seguirá figurando como no aceptado.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vigentes = await getCurrentLegalDocuments(supabase);

    if (vigentes.length === 0) {
      return NextResponse.json(
        { error: 'Todavía no hay documentos publicados que aceptar.' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);

    // `upsert` y no `insert`: aceptar dos veces —dos pestañas, un doble clic— no
    // debe fallar ni duplicar la constancia. La primera fecha es la que queda.
    const { error } = await supabase
      .from('legal_acceptances')
      .upsert(
        vigentes.map((d) => ({
          user_id: user.id,
          document_id: d.id,
          accepted_ip: ip,
        })),
        { onConflict: 'user_id,document_id', ignoreDuplicates: true }
      );

    if (error) {
      console.error('[legal] no se pudo registrar la aceptación', error.message);
      return NextResponse.json(
        { error: 'No pudimos registrar tu aceptación. Intenta de nuevo.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ accepted: vigentes.map((d) => d.id) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
