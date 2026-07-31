import { NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { Database } from '../../../../types/database_generated'
import { getSupabaseImageUrl, PRESET_COVER_DETAIL, PRESET_LOGO } from '../../../../lib/supabase/supabase-image'
import { uploadVariants, removeImageAndVariants } from '../../../../lib/images/generate'

type MarketplaceUpdate = Database['public']['Tables']['marketplaces']['Update']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('marketplaces')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  // Usar transformaciones de Supabase (síncrono, cacheable)
  const coverSignedUrl = data.cover_image_url
    ? getSupabaseImageUrl('plazas', data.cover_image_url, PRESET_COVER_DETAIL)
    : null

  const logoSignedUrl = data.logo_url
    ? getSupabaseImageUrl('plazas', data.logo_url, PRESET_LOGO)
    : null

  return NextResponse.json({ 
    data: { 
      ...data, 
      coverSignedUrl, 
      logoSignedUrl 
    } 
  }, { status: 200 })
}

export async function PUT(
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

    const updateData: MarketplaceUpdate = {}

    const name = body.name as string | null
    if (name) updateData.name = name

    const slug = body.slug as string | null
    if (slug) updateData.slug = slug

    const city = body.city as string | null
    if (city) updateData.city = city

    const department = body.department as string | null
    if (department) updateData.department = department

    const address = body.address as string | null
    if (address !== undefined) updateData.address = address

    const description = body.description as string | null
    if (description !== undefined) updateData.description = description

    if (body.latitude !== undefined) {
      updateData.latitude = body.latitude ? parseFloat(body.latitude as string) : null
    }

    if (body.longitude !== undefined) {
      updateData.longitude = body.longitude ? parseFloat(body.longitude as string) : null
    }

    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active === true || body.is_active === 'true'
    }

    if (body.business_hours !== undefined) {
      updateData.business_hours = body.business_hours || null
    }

    const { data: currentMarketplace } = await supabase
      .from('marketplaces')
      .select('cover_image_url, logo_url')
      .eq('id', id)
      .single()

    // El cliente ya subió el/los original(es) directo a Storage (evita el
    // límite de payload de las funciones serverless); acá solo descargamos
    // el buffer para generar los derivados con sharp.
    if (body.cover_image_url) {
      const path = body.cover_image_url as string
      const { data: fileData, error: downloadError } = await supabase.storage.from('plazas').download(path)
      if (downloadError) throw downloadError
      const buffer = Buffer.from(await fileData.arrayBuffer())

      updateData.cover_image_url = path
      await uploadVariants(supabase, 'plazas', path, buffer, ['cover'])

      if (currentMarketplace?.cover_image_url) {
        await removeImageAndVariants(supabase, 'plazas', currentMarketplace.cover_image_url, ['cover'])
      }
    }

    if (body.logo_url) {
      const path = body.logo_url as string
      const { data: fileData, error: downloadError } = await supabase.storage.from('plazas').download(path)
      if (downloadError) throw downloadError
      const buffer = Buffer.from(await fileData.arrayBuffer())

      updateData.logo_url = path
      await uploadVariants(supabase, 'plazas', path, buffer, ['logo'])

      if (currentMarketplace?.logo_url) {
        await removeImageAndVariants(supabase, 'plazas', currentMarketplace.logo_url, ['logo'])
      }
    }

    const { data, error } = await supabase
      .from('marketplaces')
      .update(updateData)
      .eq('id', id)
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

export async function DELETE(
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

    // Get current marketplace to delete images
    const { data: currentMarketplace } = await supabase
      .from('marketplaces')
      .select('cover_image_url, logo_url')
      .eq('id', id)
      .single()

    if (currentMarketplace?.cover_image_url) {
      await removeImageAndVariants(supabase, 'plazas', currentMarketplace.cover_image_url, ['cover'])
    }
    if (currentMarketplace?.logo_url) {
      await removeImageAndVariants(supabase, 'plazas', currentMarketplace.logo_url, ['logo'])
    }

    const { error } = await supabase
      .from('marketplaces')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
