import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { Database } from '../../../../types/database_generated'
import { authErrorMessage } from '@/lib/auth/auth-error-messages'
import { rollbackSignUp } from '@/lib/auth/rollback-signup'
import {
  getPersonTypeRules,
  getIdentificationSlug,
  validateIdentificationPair,
} from '@/lib/identification/validate'
import {
  validateDocumentNumber,
  normalizeDocumentNumber,
} from '@/lib/identification/validate-document'
import { toE164 } from '@/lib/phone/phone'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  claimCode,
  releaseCode,
  GENERIC_CODE_ERROR,
} from '@/lib/auth/verification-codes'
import { getCurrentLegalDocuments } from '@/lib/legal/current-documents'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

/** Cuánto espera la petición duplicada a que la gemela termine: 20 × 250 ms. */
const ESPERA_GEMELA_INTENTOS = 20
const ESPERA_GEMELA_MS = 250

/** El perfil de ese correo, si el registro ya quedó hecho. */
async function perfilDeEsteCorreo(
  service: ReturnType<typeof createSupabaseServiceClient>,
  email: string
) {
  const { data } = await service
    .from('profiles')
    .select('id, email, full_name, role_id, buyer_type')
    .eq('email', email)
    .maybeSingle()

  return data
}

/**
 * La respuesta para una petición que llega cuando el registro YA se hizo.
 *
 * Es el mismo patrón que `POST /api/orders` con `client_idempotency_key`:
 * el duplicado no repite el trabajo ni inventa un error, devuelve lo que
 * devolvió el original. Acá el duplicado nace de un doble clic, así que lo que
 * la persona debe ver es la pantalla de bienvenida, no "ya hay una cuenta con
 * este correo" refiriéndose a la suya.
 *
 * Solo se llega acá con un código válido de ESE correo, así que no sirve para
 * averiguar nada sobre cuentas ajenas.
 */
async function respuestaDeRegistroYaHecho(
  service: ReturnType<typeof createSupabaseServiceClient>,
  email: string
) {
  /**
   * Se espera a que la gemela termine.
   *
   * Las dos peticiones salen al mismo tiempo, así que cuando esta descubre que
   * el código ya está reclamado lo más probable es que la otra siga a mitad de
   * camino: `signUp`, el insert del perfil y las aceptaciones legales toman su
   * rato. Responder de una daría un error por algo que está a punto de salir
   * bien. Se sondea un momento y recién si no aparece se contesta otra cosa.
   */
  for (let intento = 0; intento < ESPERA_GEMELA_INTENTOS; intento++) {
    const perfil = await perfilDeEsteCorreo(service, email)
    if (perfil) {
      return NextResponse.json({ profile: perfil, idempotent: true }, { status: 200 })
    }
    await new Promise((r) => setTimeout(r, ESPERA_GEMELA_MS))
  }

  // La gemela falló o se quedó colgada. No hay un éxito que devolver ni tiene
  // sentido un error de código, así que se dice lo que de verdad está pasando.
  return NextResponse.json(
    { error: 'Ya estamos creando tu cuenta con este código. Espera unos segundos e intenta de nuevo.' },
    { status: 409 }
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      person_type_id,
      identification_type_id,
      document_number,
      full_name,
      business_name,
      contact_name,
      phone,
      buyer_type,
      terms_version,
      code,
    } = body

    const supabase = await createClient()

    // El correo se normaliza acá y se usa el normalizado en todo lo que sigue:
    // el código se emitió contra esa forma, y con `Juan@X.com` no coincidiría.
    const emailNormalizado = (email as string || '').trim().toLowerCase()

    // El tipo de persona ya no es una lista fija en el código: sale de
    // `person_types`, que el admin administra desde Parametrización.
    const personType = person_type_id
      ? await getPersonTypeRules(supabase, String(person_type_id))
      : null

    if (!personType) {
      return NextResponse.json({ error: 'El tipo de persona no es válido' }, { status: 400 })
    }

    // La regla del cliente (Natural → CC, Jurídica → NIT, Establecimiento → NIT
    // o RUT) vive en la tabla puente. Filtrar el desplegable no basta: sin esta
    // comprobación, un POST a mano registraría una persona Natural con NIT.
    const pairError = await validateIdentificationPair(
      supabase,
      String(person_type_id),
      identification_type_id ? String(identification_type_id) : null
    )
    if (pairError) {
      return NextResponse.json({ error: pairError.message }, { status: 400 })
    }

    // Qué campos de nombre se exigen es una propiedad del tipo de persona, no un
    // `if` sobre 'juridica': "Establecimiento de comercio" también lleva razón
    // social, y con el condicional anterior habría quedado pidiendo solo nombre.
    if (personType.requiresBusinessName) {
      if (!business_name || !contact_name) {
        return NextResponse.json(
          { error: 'La razón social y el nombre del contacto son requeridos para este tipo de persona' },
          { status: 400 }
        )
      }
    } else if (!full_name) {
      return NextResponse.json({ error: 'El nombre completo es requerido' }, { status: 400 })
    }

    if (buyer_type !== 'retail' && buyer_type !== 'wholesale') {
      return NextResponse.json({ error: 'buyer_type debe ser retail o wholesale' }, { status: 400 })
    }

    if (!terms_version) {
      return NextResponse.json({ error: 'Debes aceptar los términos y condiciones' }, { status: 400 })
    }

    // El teléfono se guarda en E.164; lo que no sea un número se rechaza.
    const phoneE164 = phone ? toE164(String(phone)) : null
    if (phone && !phoneE164) {
      return NextResponse.json({ error: 'El teléfono no es un número válido.' }, { status: 400 })
    }

    /**
     * El documento no se validaba en absoluto: ni formato, ni obligatorio, ni
     * repetido. El formato depende del tipo —el pasaporte lleva letras y los
     * demás no— y el `slug` se resuelve acá, no se confía en el cliente.
     *
     * Va ANTES de consumir el código: un error de formulario no debe quemar un
     * código y obligar a pedir otro.
     */
    const documentSlug = await getIdentificationSlug(supabase, identification_type_id)
    const documentoLimpio = normalizeDocumentNumber(document_number)
    const documentoError = validateDocumentNumber(document_number, documentSlug)

    if (documentoError) {
      return NextResponse.json({ error: documentoError }, { status: 400 })
    }

    const { data: documentoEnUso } = await createSupabaseServiceClient()
      .from('profiles')
      .select('id')
      .eq('document_number', documentoLimpio)
      .maybeSingle()

    if (documentoEnUso) {
      return NextResponse.json(
        {
          error:
            'Ya hay una cuenta registrada con ese número de identificación. Si es tuya, inicia sesión o recupera tu contraseña.',
        },
        { status: 400 }
      )
    }

    // El código se comprueba ANTES de crear nada. Verificarlo después dejaría
    // cuentas creadas con correos que no existen: nadie podría recuperarlas, y
    // el correo quedaría bloqueado para su dueño real.
    const service = createSupabaseServiceClient()
    const codeKey = { column: 'email' as const, value: emailNormalizado }

    /**
     * Se reclama, no solo se verifica.
     *
     * Con `consumeCode` (que verifica y deja el marcado para el final) dos
     * peticiones simultáneas —el doble clic en "Crear cuenta"— pasaban LAS DOS y
     * la segunda terminaba diciéndole a la persona que ya hay una cuenta con ese
     * correo: la que acababa de crear. `claimCode` serializa con un UPDATE
     * condicional, y `releaseCode` más abajo conserva la propiedad de poder
     * reintentar con el mismo código si algo falla después.
     */
    const verificacion = await claimCode({
      service,
      table: 'signup_email_codes',
      key: codeKey,
      code: String(code || ''),
    })

    if (verificacion.ok === 'duplicado') {
      return respuestaDeRegistroYaHecho(service, emailNormalizado)
    }

    if (!verificacion.ok) {
      return NextResponse.json({ error: GENERIC_CODE_ERROR }, { status: 400 })
    }

    // El role_id del comprador se resuelve en el servidor, nunca se confía en un role_id enviado por el cliente
    const { data: buyerRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'buyer')
      .single()

    if (roleError || !buyerRole) {
      return NextResponse.json({ error: 'No se encontró el rol de comprador' }, { status: 500 })
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailNormalizado,
      password,
    })

    if (authError) {
      // Acá no se cuela un doble clic: de dos peticiones simultáneas solo UNA
      // consigue reclamar el código, y la otra ya salió por `duplicado` mucho
      // antes. Quien llega hasta este punto con el reclamo en la mano está
      // registrando un correo que de verdad ya tiene cuenta.
      //
      // El caso más común acá es un correo que ya tiene cuenta. El `code` viaja
      // al cliente para que el formulario pueda ofrecer iniciar sesión.
      const { message, code } = authErrorMessage(
        authError,
        'No pudimos crear la cuenta. Intenta de nuevo.',
        'register-buyer'
      )
      await releaseCode({ service, table: 'signup_email_codes', id: verificacion.row.id })
      return NextResponse.json({ error: message, code }, { status: 400 })
    }

    /**
     * Supabase no siempre devuelve error con un correo que ya existe.
     *
     * Con la confirmación de correo activada, `signUp` responde 200 y un usuario
     * con `identities` vacío —su propia defensa contra averiguar quién está
     * registrado—. Sin esta comprobación, el insert del perfil fallaría por
     * clave duplicada y el `rollbackSignUp` de más abajo BORRARÍA LA CUENTA
     * REAL de esa persona. El propio helper advierte que no debe llamarse nunca
     * con un usuario preexistente.
     */
    if (authData.user && (authData.user.identities?.length ?? 0) === 0) {
      const { message, code } = authErrorMessage(
        { code: 'user_already_exists' },
        'No pudimos crear la cuenta. Intenta de nuevo.',
        'register-buyer'
      )
      await releaseCode({ service, table: 'signup_email_codes', id: verificacion.row.id })
      return NextResponse.json({ error: message, code }, { status: 400 })
    }

    const userId = authData.user?.id

    if (!userId) {
      await releaseCode({ service, table: 'signup_email_codes', id: verificacion.row.id })
      return NextResponse.json(
        { error: 'No pudimos crear la cuenta. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    const profileData: ProfileInsert = {
      id: userId,
      email: emailNormalizado,
      full_name: personType.requiresBusinessName ? contact_name : full_name,
      phone: phoneE164,
      role_id: buyerRole.id,
      buyer_type,
      person_type_id: personType.id,
      business_name: personType.requiresBusinessName ? business_name : null,
      contact_name: personType.requiresBusinessName ? contact_name : null,
      identification_type_id: String(identification_type_id),
      document_number: documentoLimpio,
      language: 'es',
      is_active: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version,
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileData)

    if (profileError) {
      // Sin el perfil la cuenta no sirve, y dejar el usuario de Auth creado
      // bloquearía ese correo para siempre. Se deshace el signUp para que la
      // persona pueda reintentar.
      console.error('[auth] register-buyer: falló el insert del perfil', profileError)
      await rollbackSignUp(userId, 'register-buyer')
      // El código vuelve a servir: la persona puede reintentar sin pedir otro.
      await releaseCode({ service, table: 'signup_email_codes', id: verificacion.row.id })

      return NextResponse.json(
        { error: 'No pudimos completar tu registro. Revisa los datos e intenta de nuevo.' },
        { status: 400 }
      )
    }

    // Constancia de qué documentos aceptó, con la versión que el SERVIDOR
    // considera vigente. `terms_version` la manda el cliente y por eso ya no se
    // usa para esto: una petición hecha a mano podía declarar cualquier cosa.
    const vigentes = await getCurrentLegalDocuments(service)

    if (vigentes.length > 0) {
      const { error: aceptacionError } = await service.from('legal_acceptances').upsert(
        vigentes.map((d) => ({ user_id: userId, document_id: d.id })),
        { onConflict: 'user_id,document_id', ignoreDuplicates: true }
      )

      // No se deshace el registro por esto: la cuenta ya existe y sirve. Sin la
      // constancia, la pantalla de aceptación se la pedirá al entrar.
      if (aceptacionError) {
        console.error('[auth] register-buyer: no se registró la aceptación', aceptacionError)
      }
    }

    return NextResponse.json({ user: authData.user, profile: profileData }, { status: 201 })
  } catch (error: unknown) {
    // Sin esto, cualquier fallo del registro era invisible en Vercel: la ruta
    // devolvía 500 y no dejaba rastro de por qué.
    console.error('[auth] register-buyer: error no controlado', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
