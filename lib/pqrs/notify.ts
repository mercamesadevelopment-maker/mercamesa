import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications/create-notification';
import { pqrsUpdateEmail, sendEmail } from '@/lib/email/resend';

/**
 * Avisos de las PQRS: la campana de la plataforma y un correo.
 *
 * Nada de acá lanza. Un aviso que no sale no puede tumbar la radicación ni la
 * respuesta: el caso ya quedó guardado, y eso es lo que importa.
 */

export type PqrsAudience = 'opener' | 'store' | 'admins';

interface PqrsForNotice {
  id: string;
  code: string;
  opened_by: string;
  store_id: string | null;
}

async function recipientsOf(
  service: SupabaseClient<any>,
  pqrs: PqrsForNotice,
  audience: PqrsAudience
): Promise<string[]> {
  if (audience === 'opener') return [pqrs.opened_by];

  if (audience === 'store') {
    if (!pqrs.store_id) return [];
    const { data } = await service.from('store_members').select('user_id').eq('store_id', pqrs.store_id);
    return (data ?? []).map((m: any) => m.user_id);
  }

  const { data } = await service
    .from('profiles')
    .select('id, roles!inner ( name )')
    .in('roles.name', ['admin', 'superadmin'])
    .eq('is_active', true);
  return (data ?? []).map((p: any) => p.id);
}

export async function notifyPqrs(
  service: SupabaseClient<any>,
  params: {
    pqrs: PqrsForNotice;
    audiences: PqrsAudience[];
    /** Quien provocó el aviso: no se le avisa de lo que él mismo hizo. */
    actorId?: string | null;
    title: string;
    message: string;
  }
): Promise<void> {
  try {
    const { pqrs, actorId, title, message } = params;

    const grupos = await Promise.all(params.audiences.map((a) => recipientsOf(service, pqrs, a)));
    const destinatarios = Array.from(new Set(grupos.flat())).filter((id) => id !== actorId);
    if (destinatarios.length === 0) return;

    await createNotification({
      type: 'pqrs_update',
      title,
      message,
      entityType: 'pqrs',
      entityId: pqrs.id,
      createdBy: actorId ?? null,
      recipientUserIds: destinatarios,
    });

    const { data: perfiles } = await service
      .from('profiles')
      .select('email')
      .in('id', destinatarios)
      .eq('is_active', true);

    const html = pqrsUpdateEmail(pqrs.code, title, message);
    await Promise.allSettled(
      (perfiles ?? [])
        .map((p: any) => p.email)
        .filter(Boolean)
        .map((to: string) => sendEmail({ to, subject: `${title} · ${pqrs.code}`, html }))
    );
  } catch (err) {
    console.error('[pqrs] no se pudo avisar', err);
  }
}
