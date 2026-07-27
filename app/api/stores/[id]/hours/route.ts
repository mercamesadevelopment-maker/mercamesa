import { NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

interface BusinessHourEntry {
  day: number
  is_closed: boolean
  open_time: string | null
  close_time: string | null
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isValidBusinessHours(value: unknown): value is BusinessHourEntry[] {
  if (!Array.isArray(value) || value.length !== 7) return false

  const seenDays = new Set<number>()

  return value.every((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry.day !== 'number' ||
      entry.day < 1 ||
      entry.day > 7 ||
      typeof entry.is_closed !== 'boolean'
    ) {
      return false
    }

    if (seenDays.has(entry.day)) return false
    seenDays.add(entry.day)

    if (entry.is_closed) {
      return entry.open_time == null && entry.close_time == null
    }

    return typeof entry.open_time === 'string' && TIME_RE.test(entry.open_time) &&
      typeof entry.close_time === 'string' && TIME_RE.test(entry.close_time)
  })
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
    if (!isValidBusinessHours(body.business_hours)) {
      return NextResponse.json({ error: 'business_hours inválido' }, { status: 400 })
    }

    // Admins pueden ajustar el horario de cualquier tienda
    const { data: profile } = await supabase
      .from('profiles')
      .select('role_id, roles ( name )')
      .eq('id', user.id)
      .single()

    const isAdmin = (profile?.roles as any)?.name === 'admin'

    if (!isAdmin) {
      const { data: storeOwnerRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'store_owner')
        .single()

      if (!storeOwnerRole) {
        return NextResponse.json({ error: 'No se encontró el rol store_owner' }, { status: 500 })
      }

      const { data: membership } = await supabase
        .from('store_members')
        .select('id')
        .eq('store_id', id)
        .eq('user_id', user.id)
        .eq('role_id', storeOwnerRole.id)
        .maybeSingle()

      if (!membership) {
        return NextResponse.json({ error: 'No tienes permisos sobre esta tienda' }, { status: 403 })
      }
    }

    const { data, error } = await supabase
      .from('stores')
      .update({ business_hours: body.business_hours })
      .eq('id', id)
      .select('id, business_hours')
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
