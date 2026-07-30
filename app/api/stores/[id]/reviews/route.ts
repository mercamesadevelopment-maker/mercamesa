import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('store_reviews')
      .select('*, profiles ( full_name )')
      .eq('store_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const stars = Number(body.stars)
    const comment = (body.comment as string) || null

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'La calificación debe ser un número entre 1 y 5' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('store_reviews')
      .upsert(
        {
          store_id: id,
          buyer_id: user.id,
          stars,
          comment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'store_id,buyer_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
