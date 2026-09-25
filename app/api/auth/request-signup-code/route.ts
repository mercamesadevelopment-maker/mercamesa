import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  checkCodeRateLimit,
  issueCode,
  getClientIp,
  RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/verification-codes'
import {
  sendEmail,
  signupCodeEmail,
  signupEmailAlreadyRegisteredEmail,
} from '@/lib/email/resend'

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

    /**
     * Si el correo ya tiene cuenta, la respuesta es la misma que si estuviera
     * libre: decir «ese correo ya existe» acá convertiría el registro en una
     * forma de averiguar quién está registrado.
     *
     * Se mira `profiles` Y `auth.users`. Antes solo `profiles`, y como `signUp`
     * mira `auth.users`, los correos que estaban en una tabla y no en la otra
     * —nueve— pasaban este filtro, recibían el código, llenaban todo el
     * formulario y solo al final se topaban con "la cuenta ya existe".
     */
    const { data: perfil } = await service
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    const yaExiste = perfil ? true : await existeEnAuth(service, email)

    if (yaExiste) {
      /**
       * El aviso que rompe el callejón sin salida.
       *
       * La pantalla no puede decir nada, así que quien se registró antes y no lo
       * recuerda se quedaba esperando un código que nunca iba a llegar. El aviso
       * va al dueño del correo, que es quien tiene derecho a saberlo.
       *
       * Se espera a que termine —no se deja suelto— pero un fallo NO cambia la
       * respuesta: si la rama del correo existente pudiera fallar distinto, el
       * código de estado delataría cuáles correos existen.
       */
      try {
        await sendEmail({
          to: email,
          subject: 'Ya tienes una cuenta en MercaMesa',
          html: signupEmailAlreadyRegisteredEmail(),
        })
      } catch (err) {
        console.error('[auth] request-signup-code: no se pudo avisar al dueño del correo', err)
      }

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
    // Sin esto, un fallo acá devolvía 500 sin dejar rastro en Vercel.
    console.error('[auth] request-signup-code: error no controlado', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * ¿Hay un usuario de Auth con ese correo, aunque no tenga perfil?
 *
 * Por RPC y no con `auth.admin.listUsers()`: ese devuelve solo los primeros 50
 * si no se pagina, o sea que funcionaría hoy y empezaría a fallar en silencio al
 * crecer el padón.
 *
 * Ante un fallo devuelve `false`: bloquear un registro legítimo porque una
 * consulta se cayó es peor que dejar pasar el caso raro, que de todos modos
 * `signUp` atajará más adelante.
 */
async function existeEnAuth(
  service: ReturnType<typeof createSupabaseServiceClient>,
  email: string
): Promise<boolean> {
  const { data, error } = await service.rpc('email_registrado_en_auth', { p_email: email })

  if (error) {
    console.error('[auth] request-signup-code: no se pudo consultar auth.users', error)
    return false
  }

  return data === true
}
