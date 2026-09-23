import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { createSupabaseStatelessClient } from '@/lib/supabase/stateless-client'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { authErrorMessage } from '@/lib/auth/auth-error-messages'
import {
  checkCodeRateLimit,
  issueCode,
  getClientIp,
  RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/verification-codes'
import { sendEmail, adminLoginCodeEmail } from '@/lib/email/resend'

/** Roles que deben verificar además con un código al correo. */
const ROLES_CON_CODIGO = ['admin', 'superadmin']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string || '').trim().toLowerCase()
    const password = body.password as string

    const service = createSupabaseServiceClient()

    // Se mira el rol ANTES de autenticar para saber con qué cliente hacerlo.
    // La respuesta no cambia según lo que se encuentre acá, así que no revela
    // si el correo existe; y si no aparece, sigue el camino normal y la
    // contraseña decide igual.
    const { data: porCorreo } = await service
      .from('profiles')
      .select('id, roles(name)')
      .eq('email', email)
      .maybeSingle()

    const necesitaCodigo = ROLES_CON_CODIGO.includes((porCorreo as any)?.roles?.name)

    // Para admin y superadmin la contraseña se comprueba con un cliente SIN
    // cookies: el de `server.ts` deja la sesión puesta apenas responde bien, y
    // entonces pedir el código después no verificaría nada, porque ya estaría
    // dentro.
    const supabase = necesitaCodigo
      ? createSupabaseStatelessClient()
      : await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const { message, code } = authErrorMessage(
        error,
        'No pudimos iniciar sesión. Intenta de nuevo.',
        'login'
      )
      return NextResponse.json({ error: message, code }, { status: 400 })
    }

    const userId = data.user?.id

    // ------------------------------------------------------------------
    // Segundo paso para admin y superadmin
    // ------------------------------------------------------------------
    if (necesitaCodigo && userId) {
      const ip = getClientIp(request)
      const key = { column: 'user_id' as const, value: userId }

      const limite = await checkCodeRateLimit({
        service,
        table: 'admin_login_codes',
        key,
        ip,
      })

      if (limite) {
        return NextResponse.json(
          { error: limite.error, retryAfterSeconds: limite.retryAfterSeconds },
          { status: limite.status }
        )
      }

      const destino = data.user!.email!

      const code = await issueCode({
        service,
        table: 'admin_login_codes',
        key,
        ip,
        extra: { email: destino },
      })

      // Si el correo no sale, NO se entra. Una segunda verificación que se
      // puede saltar haciendo fallar el envío no es una verificación: bastaría
      // con tumbar el proveedor de correo para volver al esquema de antes.
      try {
        await sendEmail({
          to: destino,
          subject: 'Tu código para ingresar - MercaMesa',
          html: adminLoginCodeEmail(code),
        })
      } catch (err) {
        console.error('[auth] login: no se pudo enviar el código de administrador', err)
        return NextResponse.json(
          {
            error:
              'No pudimos enviarte el código de verificación. Intenta de nuevo en unos minutos.',
          },
          { status: 502 }
        )
      }

      // Sin sesión y sin perfil: hasta que no verifique, no se entrega nada.
      return NextResponse.json(
        { requiresCode: true, email: destino, cooldownSeconds: RESEND_COOLDOWN_SECONDS },
        { status: 200 }
      )
    }

    // ------------------------------------------------------------------
    // El resto de roles entra de una, como siempre
    // ------------------------------------------------------------------
    let profile = null
    if (userId) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, roles(name)')
        .eq('id', userId)
        .single()
      profile = profileData
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      profile,
    }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
