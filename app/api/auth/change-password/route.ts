import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'
import { sendEmail, passwordChangedEmail } from '../../../../lib/email/resend'
import { authErrorMessage } from '@/lib/auth/auth-error-messages'
import {
  consumeCode,
  markCodeConsumed,
  GENERIC_CODE_ERROR,
} from '@/lib/auth/verification-codes'

const MIN_PASSWORD_LENGTH = 8

/**
 * Segundo paso del cambio de contraseña. La contraseña actual ya se comprobó en
 * `request-password-change`, que fue quien emitió este código; acá solo se
 * verifica el código y se aplica el cambio.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const code = (body.code as string || '').trim()
    const newPassword = body.new_password as string

    if (!code) {
      return NextResponse.json({ error: 'Debes ingresar el código que te enviamos' }, { status: 400 })
    }

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
        { status: 400 }
      )
    }

    const service = createSupabaseServiceClient()
    const key = { column: 'user_id' as const, value: user.id }

    const verificacion = await consumeCode({
      service,
      table: 'password_change_codes',
      key,
      code,
    })

    if (!verificacion.ok) {
      return NextResponse.json({ error: GENERIC_CODE_ERROR }, { status: 400 })
    }

    const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateError) {
      const { message } = authErrorMessage(
        updateError,
        'No pudimos cambiar la contraseña. Intenta de nuevo.',
        'change-password'
      )
      // El código NO se quema: el cambio no se aplicó, y lo más probable es que
      // la persona corrija la contraseña y reintente enseguida.
      return NextResponse.json({ error: message }, { status: 400 })
    }

    await markCodeConsumed({ service, table: 'password_change_codes', id: verificacion.row.id })

    // El aviso es informativo: si el cambio no fue el dueño de la cuenta, es la
    // única señal que recibe. Que falle el correo no invalida el cambio.
    try {
      await sendEmail({
        to: user.email,
        subject: 'Tu contraseña fue actualizada - MercaMesa',
        html: passwordChangedEmail(),
      })
    } catch (err) {
      console.error('change-password: failed to send notification email', err)
    }

    return NextResponse.json({ message: 'Contraseña actualizada' }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
