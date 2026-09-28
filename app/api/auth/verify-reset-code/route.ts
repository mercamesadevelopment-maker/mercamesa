import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServiceClient } from '../../../../lib/supabase/service'
import { chargeAttempt } from '@/lib/auth/verification-codes'

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

    // El intento se cobra antes de comparar y de forma atómica: leer, comparar y
    // escribir `attempts + 1` por separado dejaba que 30 peticiones simultáneas
    // contaran como 2 o 3 intentos, y acertar aquí es fijar la contraseña ajena.
    if (!row || !(await chargeAttempt({ service: supabase, table: 'password_reset_codes', row }))) {
      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    if (hashCode(code) !== row.code_hash) {
      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')

    // `consumed_at IS NULL` y exigir la fila de vuelta: dos aciertos simultáneos
    // no emiten dos `reset_token`, solo el primero en marcarlo.
    const { data: marcada, error: updateError } = await supabase
      .from('password_reset_codes')
      .update({
        consumed_at: new Date().toISOString(),
        reset_token: resetToken,
        reset_token_expires_at: new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60_000).toISOString(),
      })
      .eq('id', row.id)
      .is('consumed_at', null)
      .select('id')
      .maybeSingle()

    if (!updateError && !marcada) {
      return NextResponse.json(GENERIC_ERROR, { status: 400 })
    }

    if (updateError) {
      // Fallo interno al marcar el código como usado: el detalle va al log, no
      // a la pantalla.
      console.error('[auth] verify-reset-code: no se pudo consumir el código', updateError)
      return NextResponse.json(
        { error: 'No pudimos verificar el código. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reset_token: resetToken }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
