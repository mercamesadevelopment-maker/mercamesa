import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { Database } from '../../../../types/database_generated'

type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, full_name, phone, role_id, language, buyer_type } = body

    const supabase = await createClient()

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
