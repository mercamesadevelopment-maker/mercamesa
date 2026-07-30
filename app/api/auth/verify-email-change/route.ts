import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '../../../../lib/supabase/server'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'
import { sendEmail, emailChangeConfirmedEmail } from '../../../../lib/email/resend'

const GENERIC_ERROR = { error: 'Código inválido o expirado' }

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const code = (body.code as string || '').trim()

    if (!code) {
      return NextResponse.json({ error: 'El código es requerido' }, { status: 400 })
    }

    const service = createSupabaseServiceClient()
    const now = new Date().toISOString()

    const { data: row } = await service
      .from('email_change_codes')
      .select('*')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!row || row.attempts >= row.max_attempts) {
      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    if (hashCode(code) !== row.code_hash) {
      await service
        .from('email_change_codes')
        .update({ attempts: row.attempts + 1 })
        .eq('id', row.id)

      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    const { error: updateUserError } = await service.auth.admin.updateUserById(user.id, {
      email: row.new_email,
      email_confirm: true,
    })

    if (updateUserError) {
      return NextResponse.json({ error: updateUserError.message }, { status: 400 })
    }

    const { error: profileError } = await service
      .from('profiles')
      .update({ email: row.new_email })
      .eq('id', user.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    await service
      .from('email_change_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id)

    try {
      await sendEmail({
        to: row.current_email,
        subject: 'Tu correo fue actualizado - MercaMesa',
        html: emailChangeConfirmedEmail(row.new_email),
      })
      await sendEmail({
        to: row.new_email,
        subject: 'Tu correo fue actualizado - MercaMesa',
        html: emailChangeConfirmedEmail(row.new_email),
      })
    } catch (err) {
      console.error('verify-email-change: failed to send confirmation emails', err)
    }

    return NextResponse.json({ email: row.new_email }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
