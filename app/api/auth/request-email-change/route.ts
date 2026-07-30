import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '../../../../lib/supabase/server'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'
import { sendEmail, emailChangeCodeEmail, emailChangeNotificationEmail } from '../../../../lib/email/resend'

const CODE_EXPIRES_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 30
const MAX_CODES_PER_USER = 3
const USER_WINDOW_MINUTES = 15
const MAX_REQUESTS_PER_IP = 10
const IP_WINDOW_MINUTES = 60

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip')
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const newEmail = (body.new_email as string || '').trim().toLowerCase()
    const currentPassword = body.current_password as string

    if (!newEmail || !EMAIL_REGEX.test(newEmail)) {
      return NextResponse.json({ error: 'El nuevo correo no es válido' }, { status: 400 })
    }

    if (newEmail === user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Ese ya es tu correo actual' }, { status: 400 })
    }

    if (!currentPassword) {
      return NextResponse.json({ error: 'Debes ingresar tu contraseña actual' }, { status: 400 })
    }

    // Step-up auth: confirma que quien está detrás de la sesión conoce la contraseña actual.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 400 })
    }

    const service = createSupabaseServiceClient()
    const ip = getClientIp(request)
    const now = Date.now()

    const { data: lastRow } = await service
      .from('email_change_codes')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastRow) {
      const elapsedSeconds = (now - new Date(lastRow.created_at).getTime()) / 1000
      if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
        const retryAfterSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds)
        return NextResponse.json(
          { error: 'Espera unos segundos antes de pedir otro código', retryAfterSeconds },
          { status: 429 }
        )
      }
    }

    const userWindowStart = new Date(now - USER_WINDOW_MINUTES * 60_000).toISOString()
    const { count: userCount } = await service
      .from('email_change_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', userWindowStart)

    if ((userCount ?? 0) >= MAX_CODES_PER_USER) {
      return NextResponse.json({ error: 'Alcanzaste el límite de solicitudes. Intenta de nuevo más tarde.' }, { status: 429 })
    }

    if (ip) {
      const ipWindowStart = new Date(now - IP_WINDOW_MINUTES * 60_000).toISOString()
      const { count: ipCount } = await service
        .from('email_change_codes')
        .select('id', { count: 'exact', head: true })
        .eq('request_ip', ip)
        .gte('created_at', ipWindowStart)

      if ((ipCount ?? 0) >= MAX_REQUESTS_PER_IP) {
        return NextResponse.json({ error: 'Alcanzaste el límite de solicitudes. Intenta de nuevo más tarde.' }, { status: 429 })
      }
    }

    const { data: existingProfile } = await service
      .from('profiles')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'Ese correo ya está en uso' }, { status: 400 })
    }

    // Invalida cualquier código pendiente anterior: solo el más reciente debe ser válido.
    await service
      .from('email_change_codes')
      .update({ expires_at: new Date(now).toISOString() })
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .gt('expires_at', new Date(now).toISOString())

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')

    const { error: insertError } = await service.from('email_change_codes').insert({
      user_id: user.id,
      current_email: user.email,
      new_email: newEmail,
      code_hash: hashCode(code),
      expires_at: new Date(now + CODE_EXPIRES_MINUTES * 60_000).toISOString(),
      request_ip: ip,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    try {
      await sendEmail({
        to: newEmail,
        subject: 'Confirma tu nuevo correo - MercaMesa',
        html: emailChangeCodeEmail(code),
      })
    } catch (err) {
      console.error('request-email-change: failed to send code email', err)
      return NextResponse.json({ error: 'No se pudo enviar el código. Intenta de nuevo.' }, { status: 500 })
    }

    try {
      await sendEmail({
        to: user.email,
        subject: 'Se solicitó un cambio de correo en tu cuenta - MercaMesa',
        html: emailChangeNotificationEmail(newEmail),
      })
    } catch (err) {
      console.error('request-email-change: failed to send notification email', err)
    }

    return NextResponse.json(
      { message: 'Te enviamos un código al nuevo correo.', cooldownSeconds: RESEND_COOLDOWN_SECONDS },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
