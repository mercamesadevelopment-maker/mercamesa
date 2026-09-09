import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { sendEmail, passwordResetCodeEmail } from '@/lib/email/resend';

const CODE_EXPIRES_MINUTES = 10;

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Asistencia del administrador a un usuario que no logra entrar.
 *
 * Envía al correo del usuario el mismo código de 6 dígitos del flujo público de
 * recuperación, de modo que **el administrador nunca conoce la contraseña**: la
 * define el propio usuario. Se descartó a propósito la alternativa de generar
 * una contraseña temporal y mostrársela al administrador.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'users',
      'update',
      'No tienes permisos para asistir a este usuario'
    );
    if (denied) return denied;

    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const service = createSupabaseServiceClient();

    const { data: target } = await service
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', id)
      .maybeSingle();

    if (!target || !target.email) {
      return NextResponse.json({ error: 'El usuario no existe o no tiene correo.' }, { status: 404 });
    }

    const email = target.email.trim().toLowerCase();
    const now = Date.now();

    // Invalida los códigos pendientes: solo el más reciente debe servir.
    await service
      .from('password_reset_codes')
      .update({ expires_at: new Date(now).toISOString() })
      .eq('email', email)
      .is('consumed_at', null)
      .gt('expires_at', new Date(now).toISOString());

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

    const { error: insertError } = await service.from('password_reset_codes').insert({
      email,
      code_hash: hashCode(code),
      expires_at: new Date(now + CODE_EXPIRES_MINUTES * 60_000).toISOString(),
      request_ip: getClientIp(request),
    });

    if (insertError) {
      console.error('admin reset-password: insert failed', insertError);
      return NextResponse.json({ error: 'No se pudo generar el código.' }, { status: 500 });
    }

    try {
      await sendEmail({
        to: email,
        subject: 'Tu código de recuperación de contraseña - MercaMesa',
        html: passwordResetCodeEmail(code),
      });
    } catch (err) {
      console.error('admin reset-password: failed to send email', err);
      return NextResponse.json(
        { error: 'No se pudo enviar el correo. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // Tomar el control de una cuenta ajena queda registrado siempre.
    await service.from('admin_user_actions').insert({
      actor_id: actor.id,
      target_user_id: target.id,
      action: 'password_reset_sent',
      request_ip: getClientIp(request),
    });

    return NextResponse.json(
      { message: `Le enviamos un código de recuperación a ${email}. Vence en ${CODE_EXPIRES_MINUTES} minutos.` },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
