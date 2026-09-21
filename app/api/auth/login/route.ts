import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { authErrorMessage } from '@/lib/auth/auth-error-messages'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      const { message, code } = authErrorMessage(
        error,
        'No pudimos iniciar sesión. Intenta de nuevo.',
        'login'
      )
      return NextResponse.json({ error: message, code }, { status: 400 })
    }

    const userId = data.user?.id

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
