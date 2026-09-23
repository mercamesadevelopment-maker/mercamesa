import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { createNotification } from '@/lib/notifications/create-notification';
import { sendEmail, legalDocumentUpdatedEmail } from '@/lib/email/resend';
import { LEGAL_LABELS, type LegalKind } from './current-documents';

/** Cuántos correos salen a la vez. Resend responde en ~200 ms; de a 5 son
 *  segundos para los usuarios que hay hoy, sin abrir 24 conexiones de golpe. */
const TANDA = 5;

export type NotifyResult = { enviados: number; fallidos: number };

/**
 * Avisa a todos los usuarios activos que se publicó una versión nueva.
 *
 * Por correo y por la campana. El correo es el que pediste; la notificación en
 * la app cubre a quien no lo abra, y cuesta una sola llamada porque
 * `createNotification` ya hace el reparto a muchos destinatarios.
 *
 * `sendEmail` manda **un correo por destinatario** —no hay envío por lotes en el
 * repo— así que se va por tandas. Con 24 usuarios activos eso alcanza de sobra;
 * si esto llega a miles, acá es donde va una cola.
 */
export async function notifyLegalDocumentUpdate({
  kind,
  version,
  url,
  publishedBy,
  documentId,
}: {
  kind: LegalKind;
  version: number;
  url: string;
  publishedBy: string;
  documentId: string;
}): Promise<NotifyResult> {
  const service = createSupabaseServiceClient();

  const { data: usuarios } = await service
    .from('profiles')
    .select('id, email')
    .eq('is_active', true);

  const destinatarios = (usuarios ?? []).filter((u) => Boolean(u.email));

  if (destinatarios.length === 0) return { enviados: 0, fallidos: 0 };

  const etiqueta = LEGAL_LABELS[kind];

  // La campana primero: es una sola escritura y no depende de un tercero, así
  // que si el correo se cae el aviso igual llegó a alguna parte.
  try {
    await createNotification({
      type: 'legal_document_updated',
      title: `Se actualizó: ${etiqueta}`,
      message: `Publicamos la versión ${version} de ${etiqueta.toLowerCase()}. Revísala y acéptala para seguir usando MercaMesa.`,
      entityType: 'legal_document',
      entityId: documentId,
      createdBy: publishedBy,
      recipientUserIds: destinatarios.map((u) => u.id),
    });
  } catch (err) {
    console.error('[legal] no se pudo crear la notificación en la app', err);
  }

  const html = legalDocumentUpdatedEmail(etiqueta, version, url);
  let enviados = 0;
  let fallidos = 0;

  for (let i = 0; i < destinatarios.length; i += TANDA) {
    const tanda = destinatarios.slice(i, i + TANDA);

    const resultados = await Promise.allSettled(
      tanda.map((u) =>
        sendEmail({
          to: u.email as string,
          subject: `Se actualizó: ${etiqueta} - MercaMesa`,
          html,
        })
      )
    );

    for (const r of resultados) {
      if (r.status === 'fulfilled') enviados++;
      else {
        fallidos++;
        console.error('[legal] falló un envío', r.reason);
      }
    }
  }

  return { enviados, fallidos };
}
