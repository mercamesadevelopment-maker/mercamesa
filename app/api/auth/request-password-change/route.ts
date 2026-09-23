import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createSupabaseStatelessClient } from '@/lib/supabase/stateless-client'
import {
  checkCodeRateLimit,
  issueCode,
  getClientIp,
  RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/verification-codes'
import { sendEmail, passwordChangeCodeEmail } from '@/lib/email/resend'

/**
 * Primer paso del cambio de contraseña: confirma la contraseña actual y manda el
 * código al correo de la cuenta.
 *
 * La contraseña actual sola no alcanzaba: una sesión abierta y desatendida basta
 * para que cualquiera se quede con la cuenta, porque la contraseña vieja deja de
 * importar en cuanto se pone una nueva. El código exige además tener la bandeja.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const currentPassword = body.current_password as string

    if (!currentPassword) {
      return NextResponse.json({ error: 'Debes ingresar tu contraseña actual' }, { status: 400 })
    }

    // Se comprueba con un cliente sin cookies: hacerlo con el de la sesión la
    // reemplazaría por una nueva a mitad del flujo.
    const stateless = createSupabaseStatelessClient()
    const { error: signInError } = await stateless.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 400 })
    }

    const service = createSupabaseServiceClient()
    const ip = getClientIp(request)
    const key = { column: 'user_id' as const, value: user.id }

    const limite = await checkCodeRateLimit({
      service,
      table: 'password_change_codes',
      key,
      ip,
    })

    if (limite) {
      return NextResponse.json(
        { error: limite.error, retryAfterSeconds: limite.retryAfterSeconds },
        { status: limite.status }
      )
    }

    const code = await issueCode({
      service,
      table: 'password_change_codes',
      key,
      ip,
      extra: { email: user.email },
    })

    // Acá el correo sí es la verificación, no un aviso: si no sale, no hay cómo
    // continuar y hay que decirlo en vez de dejar a la persona esperando.
    try {
      await sendEmail({
        to: user.email,
        subject: 'Confirma el cambio de contraseña - MercaMesa',
        html: passwordChangeCodeEmail(code),
      })
    } catch (err) {
      console.error('[auth] request-password-change: no se pudo enviar el código', err)
      return NextResponse.json(
        { error: 'No pudimos enviarte el código. Intenta de nuevo en unos minutos.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { message: 'Te enviamos un código', cooldownSeconds: RESEND_COOLDOWN_SECONDS },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
