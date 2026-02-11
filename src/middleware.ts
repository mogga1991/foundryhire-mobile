import { NextRequest, NextResponse } from 'next/server'

const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/privacy',
  '/terms',
  '/forgot-password',
  '/portal/login',
  '/portal/register',
  '/portal/forgot-password',
  '/portal/reset-password',
  '/portal/verify-email',
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

function hasEmployerSessionCookie(request: NextRequest): boolean {
  const hasLegacySession = !!request.cookies.get('session_token')?.value

  if (hasLegacySession) {
    return true
  }

  // Supabase auth cookies use names like `sb-<project-ref>-auth-token`.
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'))
}

/**
 * Validate CSRF token at the middleware level (defense-in-depth)
 * Uses simple double-submit cookie pattern validation
 *
 * @param request - The incoming request
 * @param pathname - The request pathname
 * @returns NextResponse with error if invalid, null if valid or should skip
 */
function validateCsrfInMiddleware(
  request: NextRequest,
  pathname: string
): NextResponse | null {
  const method = request.method.toUpperCase()

  // Only validate state-changing methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null
  }

  // Skip CSRF validation for specific paths
  const skipPatterns = [
    '/api/webhooks/',
    '/api/auth/',
    '/api/portal/',
    '/api/csrf',
    '/api/cron/',
    '/api/candidate/',
  ]

  if (skipPatterns.some((pattern) => pathname.startsWith(pattern))) {
    return null
  }

  // Get tokens from cookie and header
  const cookieToken = request.cookies.get('csrf_token')?.value
  const headerToken = request.headers.get('x-csrf-token')

  // Both must exist
  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  // Simple string comparison (constant-time comparison is done in per-route validation)
  // At middleware level, we do basic validation; detailed validation happens in route handlers
  if (cookieToken !== headerToken) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  return null // Valid
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasEmployerSession = hasEmployerSessionCookie(request)
  const candidateSessionToken = request.cookies.get('candidate_session_token')?.value

  // CSRF Protection for API routes (defense-in-depth)
  // This is middleware-level CSRF validation; routes also use withApiMiddleware for additional protection
  if (pathname.startsWith('/api/')) {
    const csrfError = validateCsrfInMiddleware(request, pathname)
    if (csrfError) {
      return csrfError
    }
  }

  // Create response
  let response: NextResponse

  // Allow public routes
  if (isPublicRoute(pathname)) {
    response = NextResponse.next()
  }
  // Portal routes require candidate session
  else if (pathname.startsWith('/portal/') || pathname === '/portal') {
    if (!candidateSessionToken) {
      const loginUrl = new URL('/portal/login', request.url)
      response = NextResponse.redirect(loginUrl)
    } else {
      response = NextResponse.next()
    }
  }
  // Employer routes require employer session
  else if (!hasEmployerSession) {
    const loginUrl = new URL('/login', request.url)
    response = NextResponse.redirect(loginUrl)
  } else {
    response = NextResponse.next()
  }

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Content Security Policy
  // Note: Next.js requires 'unsafe-inline' for scripts even in production for hydration
  // For stricter CSP, consider implementing nonces in a custom _document.tsx
  const isDevelopment = process.env.NODE_ENV === 'development'
  const cspPolicy = [
    "default-src 'self'",
    // Next.js needs 'unsafe-inline' for hydration; 'unsafe-eval' only in dev for Fast Refresh
    isDevelopment
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // Add specific API domains for production services
    "connect-src 'self' https://api.zoom.us https://api.anthropic.com https://api.resend.com https://*.upstash.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  response.headers.set('Content-Security-Policy', cspPolicy)

  // Permissions Policy (restrict potentially dangerous features)
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
