import { type NextRequest } from 'next/server'
import { adminMarketplacesMiddleware } from './middlewares/adminAuth'
import { updateSession } from './lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Update session for all routes to keep user logged in
  let response = await updateSession(request)

  // Protect admin marketplaces route
  if (request.nextUrl.pathname.startsWith('/admin/marketplaces')) {
    response = await adminMarketplacesMiddleware(request)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
