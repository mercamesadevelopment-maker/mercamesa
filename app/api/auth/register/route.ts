import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { Database } from '../../../../types/database_generated'
import { validateIdentificationPair } from '@/lib/identification/validate'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      full_name,
      phone,
      role_id,
      language,
      buyer_type,
      person_type_id,
      identification_type_id,
      document_number,
    } = body

    const supabase = await createClient()

    // Identificación opcional acá (el formulario solo la pide a algunos roles),
    // pero si viene tiene que cumplir la misma regla que en el registro de
    // comprador: la identificación debe corresponder al tipo de persona.
    if (person_type_id || identification_type_id) {
      const pairError = await validateIdentificationPair(
        supabase,
        person_type_id,
        identification_type_id
      )
      if (pairError) {
        return NextResponse.json({ error: pairError.message }, { status: 400 })
      }
    }

    // 1. Sign up the user in auth.users
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

    // 2. Create the profile
    const profileData: ProfileInsert = {
      id: userId,
      email,
      full_name,
      phone: phone || null,
      role_id,
      language: language || 'es',
      buyer_type: buyer_type || null,
      person_type_id: person_type_id || null,
      identification_type_id: identification_type_id || null,
      document_number: document_number || null,
      is_active: true,
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
