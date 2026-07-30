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

    const formData = await request.formData()
    
    const updateData: MarketplaceUpdate = {}

    const name = formData.get('name') as string | null
    if (name) updateData.name = name

    const slug = formData.get('slug') as string | null
    if (slug) updateData.slug = slug

    const city = formData.get('city') as string | null
    if (city) updateData.city = city

    const department = formData.get('department') as string | null
    if (department) updateData.department = department

    const address = formData.get('address') as string | null
    if (address !== null) updateData.address = address

    const description = formData.get('description') as string | null
    if (description !== null) updateData.description = description

    if (formData.has('latitude')) {
      const lat = formData.get('latitude')
      updateData.latitude = lat ? parseFloat(lat as string) : null
    }

    if (formData.has('longitude')) {
      const lng = formData.get('longitude')
      updateData.longitude = lng ? parseFloat(lng as string) : null
    }

    if (formData.has('is_active')) {
      updateData.is_active = formData.get('is_active') === 'true'
    }

    if (formData.has('business_hours')) {
      const businessHours = formData.get('business_hours') as string
      updateData.business_hours = businessHours ? JSON.parse(businessHours) : null
    }

    const { data: currentMarketplace } = await supabase
      .from('marketplaces')
      .select('cover_image_url, logo_url')
      .eq('id', id)
      .single()

    // Handle Cover Image Upload
    const coverImage = formData.get('cover_image') as File | null
    if (coverImage && coverImage.size > 0) {
      const path = `imgs/${id}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`
      const buffer = Buffer.from(await coverImage.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from('plazas')
        .upload(path, buffer, { contentType: coverImage.type || undefined })

      if (uploadError) throw uploadError
      updateData.cover_image_url = path
      await uploadVariants(supabase, 'plazas', path, buffer, ['cover'])

      if (currentMarketplace?.cover_image_url) {
        await removeImageAndVariants(supabase, 'plazas', currentMarketplace.cover_image_url, ['cover'])
      }
    }

    // Handle Logo Upload
    const logoImage = formData.get('logo') as File | null
    if (logoImage && logoImage.size > 0) {
      const path = `imgs/${id}/logo-${Date.now()}.${logoImage.name.split('.').pop()}`
      const buffer = Buffer.from(await logoImage.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from('plazas')
        .upload(path, buffer, { contentType: logoImage.type || undefined })

      if (uploadError) throw uploadError
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
