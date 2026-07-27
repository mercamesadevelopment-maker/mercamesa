import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'

const RESET_TOKEN_EXPIRES_MINUTES = 10
const GENERIC_ERROR = { error: 'Código inválido o expirado' }

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string || '').trim().toLowerCase()
    const code = (body.code as string || '').trim()

    if (!email || !code) {
      return NextResponse.json({ error: 'El correo y el código son requeridos' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const now = new Date().toISOString()

    const { data: row } = await supabase
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!row || row.attempts >= row.max_attempts) {
      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    if (hashCode(code) !== row.code_hash) {
      await supabase
        .from('password_reset_codes')
        .update({ attempts: row.attempts + 1 })
        .eq('id', row.id)

      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')

    const { error: updateError } = await supabase
      .from('password_reset_codes')
      .update({
        consumed_at: new Date().toISOString(),
        reset_token: resetToken,
        reset_token_expires_at: new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60_000).toISOString(),
      })
      .eq('id', row.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ reset_token: resetToken }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
