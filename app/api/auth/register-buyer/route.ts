import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { Database } from '../../../../types/database_generated'
import { getPersonTypeRules, validateIdentificationPair } from '@/lib/identification/validate'

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
    } = body

    const supabase = await createClient()

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
      email,
      password,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'User creation failed' }, { status: 500 })
    }

    const profileData: ProfileInsert = {
      id: userId,
      email,
      full_name: personType.requiresBusinessName ? contact_name : full_name,
      phone: phone || null,
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
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ user: authData.user, profile: profileData }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
