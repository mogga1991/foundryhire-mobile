import { NextRequest, NextResponse } from 'next/server'

const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/forgot-password',
  '/portal',
  '/candidate/login',
  '/candidate/register',
  '/candidate/forgot-password',
  '/candidate/reset-password',
  '/candidate/verify-email',
  '/api/webhooks',
  '/api/health',
  '/api/auth',
  '/api/candidate',
  '/api/track',
  '/api/portal',
  '/api/admin',
  '/api/email/unsubscribe',
  '/api/email/connect/gmail/callback',
  '/api/email/connect/microsoft/callback',
]

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session_token')?.value

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Redirect to login if no session
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
