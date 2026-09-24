import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { Database } from '../../../../types/database_generated'
import { authErrorMessage } from '@/lib/auth/auth-error-messages'
import { rollbackSignUp } from '@/lib/auth/rollback-signup'
import { getPersonTypeRules, validateIdentificationPair } from '@/lib/identification/validate'
import { toE164 } from '@/lib/phone/phone'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
  consumeCode,
  markCodeConsumed,
  GENERIC_CODE_ERROR,
} from '@/lib/auth/verification-codes'
import { getCurrentLegalDocuments } from '@/lib/legal/current-documents'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

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

    // El código se comprueba ANTES de crear nada. Verificarlo después dejaría
    // cuentas creadas con correos que no existen: nadie podría recuperarlas, y
    // el correo quedaría bloqueado para su dueño real.
    const service = createSupabaseServiceClient()
    const codeKey = { column: 'email' as const, value: emailNormalizado }

    const verificacion = await consumeCode({
      service,
      table: 'signup_email_codes',
      key: codeKey,
      code: String(code || ''),
    })

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
      // El caso más común acá es un correo que ya tiene cuenta. El `code` viaja
      // al cliente para que el formulario pueda ofrecer iniciar sesión.
      const { message, code } = authErrorMessage(
        authError,
        'No pudimos crear la cuenta. Intenta de nuevo.',
        'register-buyer'
      )
      return NextResponse.json({ error: message, code }, { status: 400 })
    }

    const userId = authData.user?.id

    if (!userId) {
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
      document_number: document_number || null,
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

    // Recién ahora se quema el código: si el registro hubiera fallado más
    // arriba, la persona podría reintentar con el mismo en vez de pedir otro.
    await markCodeConsumed({ service, table: 'signup_email_codes', id: verificacion.row.id })

    return NextResponse.json({ user: authData.user, profile: profileData }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
