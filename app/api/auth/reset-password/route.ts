import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'

const GENERIC_ERROR = { error: 'El enlace de recuperación es inválido o expiró' }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string || '').trim().toLowerCase()
    const resetToken = body.reset_token as string
    const newPassword = body.new_password as string

    if (!email || !resetToken || !newPassword) {
      return NextResponse.json({ error: 'email, reset_token y new_password son requeridos' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const now = new Date().toISOString()

    const { data: row } = await supabase
      .from('password_reset_codes')
      .select('id')
      .eq('email', email)
      .eq('reset_token', resetToken)
      .not('consumed_at', 'is', null)
      .gt('reset_token_expires_at', now)
      .maybeSingle()

    if (!row) {
      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    const { error: updateUserError } = await supabase.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    })

    if (updateUserError) {
      return NextResponse.json({ error: updateUserError.message }, { status: 400 })
    }

    // El token es de un solo uso: se invalida aunque el reseteo haya fallado antes de llegar aquí.
    await supabase
      .from('password_reset_codes')
      .update({ reset_token: null, reset_token_expires_at: null })
      .eq('id', row.id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
