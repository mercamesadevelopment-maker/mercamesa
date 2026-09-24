import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  checkCodeRateLimit,
  issueCode,
  getClientIp,
  RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/verification-codes'
import { sendEmail, signupCodeEmail } from '@/lib/email/resend'

/**
 * Manda el código que confirma el correo **antes** de crear la cuenta.
 *
 * No pide sesión: quien se registra todavía no tiene. Por eso los límites por IP
 * del módulo compartido importan más acá que en ningún otro flujo — son lo que
 * impide usar esta ruta para barrer correos o para inundar bandejas ajenas.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string || '').trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'El correo no es válido.' }, { status: 400 })
    }

    const service = createSupabaseServiceClient()
    const ip = getClientIp(request)
    const key = { column: 'email' as const, value: email }

    const limite = await checkCodeRateLimit({
      service,
      table: 'signup_email_codes',
      key,
      ip,
    })

    if (limite) {
      return NextResponse.json(
        { error: limite.error, retryAfterSeconds: limite.retryAfterSeconds },
        { status: limite.status }
      )
    }

    // Si el correo ya tiene cuenta, igual se responde que se envió y NO se manda
    // nada. Decir «ese correo ya existe» acá convertiría el registro en una
    // forma de averiguar quién está registrado; el aviso correcto aparece al
    // crear la cuenta, cuando la persona ya demostró tener la bandeja.
    const { data: existente } = await service
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existente) {
      return NextResponse.json(
        { message: 'Si el correo está disponible, te enviamos un código.', cooldownSeconds: RESEND_COOLDOWN_SECONDS },
        { status: 200 }
      )
    }

    const code = await issueCode({
      service,
      table: 'signup_email_codes',
      key,
      ip,
    })

    try {
      await sendEmail({
        to: email,
        subject: 'Confirma tu correo - MercaMesa',
        html: signupCodeEmail(code),
      })
    } catch (err) {
      console.error('[auth] request-signup-code: no se pudo enviar el código', err)
      return NextResponse.json(
        { error: 'No pudimos enviarte el código. Revisa el correo e intenta de nuevo.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { message: 'Si el correo está disponible, te enviamos un código.', cooldownSeconds: RESEND_COOLDOWN_SECONDS },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
