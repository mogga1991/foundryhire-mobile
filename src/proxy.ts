import { NextRequest, NextResponse } from 'next/server'

const publicRoutes = [
  '/',
  '/privacy',
  '/terms',
  '/portal/login',
  '/portal/register',
  '/portal/forgot-password',
  '/portal/reset-password',
  '/portal/verify-email',
  '/manifest.json',
  '/site.webmanifest',
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

function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'))
}

function isPublicCandidatePortalPath(pathname: string): boolean {
  const match = pathname.match(/^\/portal\/([^/]+)$/)
  if (!match) {
    return false
  }

  const tokenSegment = match[1]
  const reservedSegments = new Set([
    'login',
    'register',
    'forgot-password',
    'reset-password',
    'verify-email',
    'notifications',
    'dashboard',
    'profile',
    'settings',
  ])

  return !reservedSegments.has(tokenSegment)
}

function validateCsrfInMiddleware(
  request: NextRequest,
  pathname: string
): NextResponse | null {
  const method = request.method.toUpperCase()

  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null
  }

  const skipPatterns = [
    '/api/webhooks/',
    '/api/auth/',
    '/api/portal/',
    '/api/interviews/candidate/',
    '/api/csrf',
    '/api/cron/',
    '/api/candidate/',
  ]

  if (skipPatterns.some((pattern) => pathname.startsWith(pattern))) {
    return null
  }

  const cookieToken = request.cookies.get('csrf_token')?.value
  const headerToken = request.headers.get('x-csrf-token')

  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  if (cookieToken !== headerToken) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  return null
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const candidateSessionToken = request.cookies.get('candidate_session_token')?.value
  const hasCandidateSession = !!candidateSessionToken || hasSupabaseSessionCookie(request)

  if (pathname.startsWith('/api/')) {
    const csrfError = validateCsrfInMiddleware(request, pathname)
    if (csrfError) {
      return csrfError
    }
  }

  let response: NextResponse

  if (isPublicRoute(pathname) || isPublicCandidatePortalPath(pathname)) {
    response = NextResponse.next()
  } else if (pathname.startsWith('/portal/') || pathname === '/portal') {
    if (!hasCandidateSession) {
      const loginUrl = new URL('/portal/login', request.url)
      response = NextResponse.redirect(loginUrl)
    } else {
      response = NextResponse.next()
    }
  } else {
    // Employer routes are intentionally public.
    response = NextResponse.next()
  }

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  const isDevelopment = process.env.NODE_ENV === 'development'
  const cspPolicy = [
    "default-src 'self'",
    isDevelopment
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.zoom.us https://api.anthropic.com https://api.resend.com https://*.upstash.io",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  response.headers.set('Content-Security-Policy', cspPolicy)

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  return response
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
