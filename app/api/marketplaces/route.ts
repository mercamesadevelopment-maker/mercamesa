import { NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { Database } from '../../../types/database_generated'
import { getSupabaseImageUrl, PRESET_COVER, PRESET_LOGO } from '../../../lib/supabase/supabase-image'
import { getStoragePublicUrl } from '../../../lib/supabase/utils'
import { uploadVariants } from '../../../lib/images/generate'

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

  const dataWithUrls = data?.map((plaza) => {
    const coverSignedUrl = plaza.cover_image_url
      ? getSupabaseImageUrl('plazas', plaza.cover_image_url, PRESET_COVER)
      : null;
    const logoSignedUrl = plaza.logo_url
      ? getSupabaseImageUrl('plazas', plaza.logo_url, PRESET_LOGO)
      : null;
    return {
      ...plaza,
      coverSignedUrl,
      logoSignedUrl,
      // El GIF va original: las variantes WebP le quitarían la animación.
      hoverGifUrl: getStoragePublicUrl('plazas', plaza.hover_gif_url),
    };
  });

  return NextResponse.json({ data: dataWithUrls }, { status: 200 })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const denied = await requirePermission(supabase, 'marketplace', 'create', 'No tienes permisos para crear plazas')
    if (denied) return denied

    const body = await request.json()

    // El cliente genera el ID de antemano para poder construir la ruta de
    // Storage antes de guardar; si no viene, se genera acá igual.
    const marketplaceId = (body.id as string) || crypto.randomUUID()

    const name = body.name as string
    const slug = body.slug as string
    const city = body.city as string
    const department = body.department as string
    const address = (body.address as string) || null
    const description = (body.description as string) || null
    const latitude = body.latitude ? parseFloat(body.latitude as string) : null
    const longitude = body.longitude ? parseFloat(body.longitude as string) : null
    const is_active = body.is_active === true || body.is_active === 'true'
    const business_hours = body.business_hours || null

    if (!name || !slug || !city || !department) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // El cliente ya subió el/los original(es) directo a Storage (evita el
    // límite de payload de las funciones serverless); acá solo descargamos
    // el buffer para generar los derivados con sharp.
    let cover_image_url: string | null = null
    let logo_url: string | null = null

    if (body.cover_image_url) {
      cover_image_url = body.cover_image_url as string
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('plazas')
        .download(cover_image_url)
      if (downloadError) throw downloadError
      const buffer = Buffer.from(await fileData.arrayBuffer())
      await uploadVariants(supabase, 'plazas', cover_image_url, buffer, ['cover'])
    }

    if (body.logo_url) {
      logo_url = body.logo_url as string
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('plazas')
        .download(logo_url)
      if (downloadError) throw downloadError
      const buffer = Buffer.from(await fileData.arrayBuffer())
      await uploadVariants(supabase, 'plazas', logo_url, buffer, ['logo'])
    }

    // El GIF se guarda tal cual: sin variantes, que lo pasarían a WebP sin animación.
    const hover_gif_url = (body.hover_gif_url as string) || null

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
      hover_gif_url,
      business_hours,
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
