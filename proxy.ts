import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/', '/accept-invite']

// Únicos destinos a los que puede apuntar un link compartido (producto o
// tienda). Se preserva solo para estos, para no mandar de vuelta a alguien sin
// sesión a `/admin/...` tras loguearse, donde de todos modos no tendría permiso.
const SHAREABLE_PREFIXES = ['/stores/', '/sections/']

const ROLE_FAMILY_BY_PREFIX: Record<string, string[]> = {
  // superadmin entra a todo /admin; el filtro fino por módulo lo hace el bloque 2.
  '/admin': ['admin', 'superadmin'],
  '/seller': ['seller', 'store_owner'],
  '/delivery': ['delivery'],
}

const normalize = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p)

/**
 * Rebote por falta de permisos, marcado.
 *
 * La página de inicio reenvía a quien tiene sesión a la ruta de su rol, así que
 * un rebote sin marca se convierte en un ping-pong: el proxy manda a `/`, la
 * página manda de vuelta, y lo único que se ve es una página congelada. Pasó de
 * verdad con `superadmin`, y costó encontrarlo justamente porque no se parecía
 * a un problema de permisos.
 */
function rebotarSinPermiso(request: NextRequest) {
  const url = new URL('/', request.url)
  url.searchParams.set('sin_acceso', normalize(request.nextUrl.pathname))
  return NextResponse.redirect(url)
}

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
    if (!isPublic) {
      const url = new URL('/', request.url)
      // Para que un link compartido (producto o tienda) funcione de punta a
      // punta: sin esto, tras iniciar sesión la persona caía en su panel de rol
      // en vez de en lo que le compartieron.
      if (SHAREABLE_PREFIXES.some((p) => pathname.startsWith(p))) {
        url.searchParams.set('redirect', pathname + request.nextUrl.search)
      }
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  if (isPublic) return supabaseResponse

  const { data: profile } = await supabase
    .from('profiles')
    .select('role_id, is_active, roles(name)')
    .eq('id', user.id)
    .single()

  const roleName = (profile?.roles as any)?.name

  // 0) Cuenta inactiva
  //
  // El login ya lo impide, pero eso no alcanza para quien ya estaba adentro
  // cuando lo inactivaron: aunque se le cierren las sesiones, el acceso ya
  // emitido sigue sirviendo hasta una hora. Acá se corta en la siguiente
  // navegación. El vencimiento del periodo no se resuelve en el proxy —no tiene
  // service key y esto corre en cada petición—: lo levanta el próximo ingreso.
  if (profile?.is_active === false) {
    const url = new URL('/', request.url)
    url.searchParams.set('cuenta_inactiva', '1')
    return NextResponse.redirect(url)
  }

  // 1) Familia de rol por prefijo de sección (admin/seller/delivery)
  const matchedPrefix = Object.keys(ROLE_FAMILY_BY_PREFIX).find((p) => pathname.startsWith(p))
  if (matchedPrefix && !ROLE_FAMILY_BY_PREFIX[matchedPrefix].includes(roleName)) {
    return rebotarSinPermiso(request)
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

    if (!count) return rebotarSinPermiso(request)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
