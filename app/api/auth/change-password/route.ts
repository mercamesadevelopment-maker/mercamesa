import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'
import { sendEmail, passwordChangedEmail } from '../../../../lib/email/resend'

const MIN_PASSWORD_LENGTH = 8

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const currentPassword = body.current_password as string
    const newPassword = body.new_password as string

    if (!currentPassword) {
      return NextResponse.json({ error: 'Debes ingresar tu contraseña actual' }, { status: 400 })
    }

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
        { status: 400 }
      )
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe ser distinta de la actual' },
        { status: 400 }
      )
    }

    // Step-up auth: teniendo sesión no hace falta el código por correo, pero sí
    // confirmar que quien está detrás de ella conoce la contraseña actual. Mismo
    // criterio que el cambio de correo (`request-email-change`).
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 400 })
    }

    const service = createSupabaseServiceClient()
    const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

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
