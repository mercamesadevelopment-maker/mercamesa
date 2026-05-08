import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { Database } from '../../../types/database_generated'

type MarketplaceInsert = Database['public']['Tables']['marketplaces']['Insert']

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const active = searchParams.get('is_active')

  let query = supabase.from('marketplaces').select('*')
  
  if (active !== null) {
    query = query.eq('is_active', active === 'true')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ data }, { status: 200 })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    
    // We generate an ID beforehand so we can use it for the image folder
    const marketplaceId = crypto.randomUUID()
    
    const name = formData.get('name') as string
    const slug = formData.get('slug') as string
    const city = formData.get('city') as string
    const department = formData.get('department') as string
    const address = formData.get('address') as string | null
    const description = formData.get('description') as string | null
    const latitude = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null
    const longitude = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null
    const is_active = formData.get('is_active') === 'true'

    if (!name || !slug || !city || !department) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let cover_image_url: string | null = null
    let logo_url: string | null = null

    // Handle Cover Image Upload
    const coverImage = formData.get('cover_image') as File | null
    if (coverImage && coverImage.size > 0) {
      const path = `imgs/${marketplaceId}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('plazas')
        .upload(path, coverImage)
      
      if (uploadError) throw uploadError
      cover_image_url = path
    }

    // Handle Logo Upload
    const logoImage = formData.get('logo') as File | null
    if (logoImage && logoImage.size > 0) {
      const path = `imgs/${marketplaceId}/logo-${Date.now()}.${logoImage.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('plazas')
        .upload(path, logoImage)
      
      if (uploadError) throw uploadError
      logo_url = path
    }

    const insertData: MarketplaceInsert = {
      id: marketplaceId,
      name,
      slug,
      city,
      department,
      address,
      description,
      latitude,
      longitude,
      is_active,
      cover_image_url,
      logo_url,
      created_by: user.id
    }

    const { data, error } = await supabase
      .from('marketplaces')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
