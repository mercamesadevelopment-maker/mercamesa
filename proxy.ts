import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/', '/accept-invite']

const ROLE_FAMILY_BY_PREFIX: Record<string, string[]> = {
  '/admin': ['admin'],
  '/seller': ['seller', 'store_owner'],
  '/delivery': ['delivery'],
}

const normalize = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p)

export async function proxy(request: NextRequest) {
  const supabaseResponse = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = normalize(request.nextUrl.pathname)

  const isPublic = PUBLIC_PATHS.includes(pathname)
  const isApiRoute = pathname.startsWith('/api')

  // Las rutas de API manejan su propio 401 en cada route.ts; un redirect
  // aquí rompería cualquier fetch() que espere una respuesta JSON.
  if (isApiRoute) return supabaseResponse

  if (!user) {
    if (!isPublic) return NextResponse.redirect(new URL('/', request.url))
    return supabaseResponse
  }

  if (isPublic) return supabaseResponse

  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id, roles(name)')
    .eq('id', user.id)
    .single()

  const roleName = (profile?.roles as any)?.name

  // 1) Familia de rol por prefijo de sección (admin/seller/delivery)
  const matchedPrefix = Object.keys(ROLE_FAMILY_BY_PREFIX).find((p) => pathname.startsWith(p))
  if (matchedPrefix && !ROLE_FAMILY_BY_PREFIX[matchedPrefix].includes(roleName)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 2) Permiso fino sobre el módulo exacto de esta ruta, si existe uno definido
  const { data: moduleRow } = await supabase.from('modules').select('id').eq('path', pathname).maybeSingle()

  if (moduleRow) {
    const { count } = await supabase
      .from('role_permissions')
      .select('id, actions!inner(name)', { count: 'exact', head: true })
      .eq('role_id', profile?.role_id)
      .eq('module_id', moduleRow.id)
      .eq('actions.name', 'read')

    if (!count) return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
