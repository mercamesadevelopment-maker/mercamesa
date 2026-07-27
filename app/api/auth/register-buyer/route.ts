import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { Database } from '../../../../types/database_generated'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      person_type,
      document_type,
      document_number,
      full_name,
      business_name,
      contact_name,
      phone,
      buyer_type,
      terms_version,
    } = body

    if (person_type !== 'natural' && person_type !== 'juridica') {
      return NextResponse.json({ error: 'person_type debe ser natural o juridica' }, { status: 400 })
    }

    if (person_type === 'natural' && !full_name) {
      return NextResponse.json({ error: 'full_name es requerido para persona natural' }, { status: 400 })
    }

    if (person_type === 'juridica' && (!business_name || !contact_name)) {
      return NextResponse.json({ error: 'business_name y contact_name son requeridos para persona jurídica' }, { status: 400 })
    }

    if (buyer_type !== 'retail' && buyer_type !== 'wholesale') {
      return NextResponse.json({ error: 'buyer_type debe ser retail o wholesale' }, { status: 400 })
    }

    if (!terms_version) {
      return NextResponse.json({ error: 'Debes aceptar los términos y condiciones' }, { status: 400 })
    }

    const supabase = await createClient()

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
      full_name: person_type === 'juridica' ? contact_name : full_name,
      phone: phone || null,
      role_id: buyerRole.id,
      buyer_type,
      person_type,
      business_name: person_type === 'juridica' ? business_name : null,
      contact_name: person_type === 'juridica' ? contact_name : null,
      document_type: document_type || null,
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
