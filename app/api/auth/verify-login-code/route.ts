import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  consumeCode,
  markCodeConsumed,
  GENERIC_CODE_ERROR,
} from '@/lib/auth/verification-codes'

/**
 * Segundo paso del ingreso de admin y superadmin: valida el código y **recién
 * entonces** crea la sesión.
 *
 * La sesión se monta con un enlace mágico generado del lado del servidor y
 * canjeado de inmediato, en vez de volver a pedir la contraseña. `generateLink`
 * no envía ningún correo: solo produce el token que `verifyOtp` canjea. Así la
 * contraseña no tiene que quedarse guardada en el navegador entre el primer paso
 * y el segundo.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string || '').trim().toLowerCase()
    const code = (body.code as string || '').trim()

    if (!email || !code) {
      return NextResponse.json(
        { error: 'El correo y el código son requeridos' },
        { status: 400 }
      )
    }

    const service = createSupabaseServiceClient()

    const { data: profile } = await service
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    // Mismo mensaje que un código equivocado: que no se pueda distinguir un
    // correo que no existe de uno que sí, probando códigos cualquiera.
    if (!profile) {
      return NextResponse.json({ error: GENERIC_CODE_ERROR }, { status: 400 })
    }

    const key = { column: 'user_id' as const, value: profile.id }

    const resultado = await consumeCode({
      service,
      table: 'admin_login_codes',
      key,
      code,
    })

    if (!resultado.ok) {
      return NextResponse.json({ error: GENERIC_CODE_ERROR }, { status: 400 })
    }

    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    const hashedToken = (link?.properties as any)?.hashed_token

    if (linkError || !hashedToken) {
      console.error('[auth] verify-login-code: no se pudo generar el enlace', linkError)
      return NextResponse.json(
        { error: 'No pudimos completar el ingreso. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    // Sobre el cliente con cookies: acá es donde queda la sesión.
    const supabase = await createClient()
    const { data: sesion, error: otpError } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: hashedToken,
    })

    if (otpError || !sesion.user) {
      console.error('[auth] verify-login-code: no se pudo canjear el token', otpError)
      return NextResponse.json(
        { error: 'No pudimos completar el ingreso. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    // Se marca usado solo ahora: si algo hubiera fallado arriba, la persona se
    // habría quedado sin código y sin sesión, y tendría que pedir otro.
    await markCodeConsumed({ service, table: 'admin_login_codes', id: resultado.row.id })

    const { data: perfilCompleto } = await supabase
      .from('profiles')
      .select('*, roles(name)')
      .eq('id', sesion.user.id)
      .single()

    return NextResponse.json({
      user: sesion.user,
      session: sesion.session,
      profile: perfilCompleto,
    }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
