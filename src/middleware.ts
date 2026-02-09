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
  const employerSessionToken = request.cookies.get('session_token')?.value
  const candidateSessionToken = request.cookies.get('candidate_session_token')?.value

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Candidate routes require candidate session
  if (pathname.startsWith('/candidate')) {
    if (!candidateSessionToken) {
      const loginUrl = new URL('/candidate/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Employer routes require employer session
  if (!employerSessionToken) {
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
