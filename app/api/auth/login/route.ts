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
import { bloqueoPorInactividad } from '@/lib/auth/deactivation'

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
      .select('id, is_active, roles(name)')
      .eq('email', email)
      .maybeSingle()

    // Una PISTA de con qué cliente autenticar, nada más. Si acierta, quien no
    // debe recibir sesión nunca la recibe. Si falla —un correo guardado con otra
    // capitalización, un perfil que todavía no existe—, la comprobación real de
    // más abajo, que va por id, lo ataja igual.
    const sospecha =
      ROLES_CON_CODIGO.includes((porCorreo as any)?.roles?.name) || porCorreo?.is_active === false

    // Con `sospecha` la contraseña se comprueba con un cliente SIN cookies: el
    // de `server.ts` deja la sesión puesta apenas responde bien, y entonces
    // pedir el código después no verificaría nada, porque ya estaría dentro.
    const conCookies = !sospecha
    const supabase = sospecha ? createSupabaseStatelessClient() : await createClient()

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

    /**
     * Deshace la sesión que el cliente con cookies ya dejó puesta.
     *
     * Solo hace falta cuando la pista de arriba se equivocó. Sin esto, un
     * correo que no calce en la búsqueda previa entregaría la sesión igual —a
     * una cuenta inactiva, o a un administrador sin pedirle el código, que es
     * lo grave.
     */
    const deshacerSesion = async () => {
      if (conCookies) await supabase.auth.signOut()
    }

    // El rol y el estado se vuelven a leer por ID, que es lo único fiable: acá
    // ya se sabe de quién es la cuenta.
    const { data: perfilReal } = userId
      ? await service.from('profiles').select('roles(name)').eq('id', userId).maybeSingle()
      : { data: null }

    const necesitaCodigo = ROLES_CON_CODIGO.includes((perfilReal as any)?.roles?.name)

    // ------------------------------------------------------------------
    // Cuenta inactiva
    //
    // Se comprueba DESPUÉS de la contraseña, nunca antes: responder distinto
    // según el estado de la cuenta sin exigir credenciales convertiría el login
    // en una forma de averiguar quién está inactivo, o incluso quién existe.
    //
    // Va también antes del código de administrador, para no gastarle un envío
    // de correo a quien de todos modos no va a poder entrar.
    // ------------------------------------------------------------------
    if (userId) {
      const bloqueo = await bloqueoPorInactividad(service, userId)
      if (bloqueo) {
        await deshacerSesion()
        return NextResponse.json({ error: bloqueo }, { status: 403 })
      }
    }

    if (necesitaCodigo && conCookies) {
      await deshacerSesion()
    }

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
    //
    // Si se llegó acá con el cliente sin cookies fue porque la cuenta figuraba
    // inactiva y su periodo acababa de vencer: `bloqueoPorInactividad` la
    // reactivó y ahora sí hay que dejar la sesión puesta, que es lo que ese
    // cliente no hace.
    let sesion = supabase
    if (!conCookies) {
      sesion = await createClient()
      const { error: sesionError } = await sesion.auth.signInWithPassword({ email, password })
      if (sesionError) {
        const { message, code } = authErrorMessage(
          sesionError,
          'No pudimos iniciar sesión. Intenta de nuevo.',
          'login'
        )
        return NextResponse.json({ error: message, code }, { status: 400 })
      }
    }

    let profile = null
    if (userId) {
      const { data: profileData } = await sesion
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
