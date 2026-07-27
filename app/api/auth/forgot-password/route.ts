import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'
import { sendEmail, passwordResetCodeEmail } from '../../../../lib/email/resend'

const CODE_EXPIRES_MINUTES = 10
const MAX_CODES_PER_EMAIL = 3
const EMAIL_WINDOW_MINUTES = 15
const MAX_REQUESTS_PER_IP = 10
const IP_WINDOW_MINUTES = 60

const GENERIC_MESSAGE = { message: 'Si el correo existe, enviamos un código de recuperación.' }

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return request.headers.get('x-real-ip')
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string || '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const ip = getClientIp(request)
    const now = Date.now()

    const emailWindowStart = new Date(now - EMAIL_WINDOW_MINUTES * 60_000).toISOString()
    const { count: emailCount } = await supabase
      .from('password_reset_codes')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', emailWindowStart)

    if ((emailCount ?? 0) >= MAX_CODES_PER_EMAIL) {
      return NextResponse.json(GENERIC_MESSAGE, { status: 200 })
    }

    if (ip) {
      const ipWindowStart = new Date(now - IP_WINDOW_MINUTES * 60_000).toISOString()
      const { count: ipCount } = await supabase
        .from('password_reset_codes')
        .select('id', { count: 'exact', head: true })
        .eq('request_ip', ip)
        .gte('created_at', ipWindowStart)

      if ((ipCount ?? 0) >= MAX_REQUESTS_PER_IP) {
        return NextResponse.json(GENERIC_MESSAGE, { status: 200 })
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(GENERIC_MESSAGE, { status: 200 })
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')

    // Cualquier falla de aquí en adelante se registra en logs pero responde
    // igual que el caso feliz, para no filtrar si el correo existe.
    try {
      const { error: insertError } = await supabase.from('password_reset_codes').insert({
        email,
        code_hash: hashCode(code),
        expires_at: new Date(now + CODE_EXPIRES_MINUTES * 60_000).toISOString(),
        request_ip: ip,
      })

      if (insertError) throw new Error(insertError.message)

      await sendEmail({
        to: email,
        subject: 'Tu código de recuperación de contraseña - MercaMesa',
        html: passwordResetCodeEmail(code),
      })
    } catch (err) {
      console.error('forgot-password: failed to create/send reset code', err)
    }

    return NextResponse.json(GENERIC_MESSAGE, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
