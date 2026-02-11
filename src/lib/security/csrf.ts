/**
 * CSRF Protection using Double Submit Cookie Pattern
 *
 * This is a stateless CSRF protection mechanism that works well with Next.js.
 * The token is stored in both a cookie (httpOnly) and sent in a custom header.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { env } from '@/lib/env'

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_LENGTH = 32

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex')
}

/**
 * Set CSRF token as an httpOnly cookie
 *
 * @param response - The NextResponse to set the cookie on
 * @param token - The CSRF token to set
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })
}

/**
 * Get CSRF token from request cookies
 *
 * @param request - The NextRequest to get the token from
 * @returns The CSRF token or null if not found
 */
export function getCsrfTokenFromCookie(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null
}

/**
 * Get CSRF token from request headers
 *
 * @param request - The NextRequest to get the token from
 * @returns The CSRF token or null if not found
 */
export function getCsrfTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME) || null
}

/**
 * Validate CSRF token using double submit cookie pattern
 *
 * @param request - The NextRequest to validate
 * @returns NextResponse with error if invalid, null if valid
 */
export function validateCsrfToken(request: NextRequest): NextResponse | null {
  // Only validate state-changing methods
  const method = request.method.toUpperCase()
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return null // No validation needed for GET, HEAD, OPTIONS
  }

  const cookieToken = getCsrfTokenFromCookie(request)
  const headerToken = getCsrfTokenFromHeader(request)

  // Both tokens must exist
  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      { error: 'CSRF token missing' },
      { status: 403 }
    )
  }

  // Tokens must match (constant-time comparison to prevent timing attacks)
  if (!timingSafeEqual(cookieToken, headerToken)) {
    return NextResponse.json(
      { error: 'CSRF token invalid' },
      { status: 403 }
    )
  }

  return null // Valid
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * CSRF middleware for API routes
 * Add this to your API routes that need CSRF protection
 *
 * @param request - The NextRequest to validate
 * @returns NextResponse with error if CSRF validation fails, null if valid
 */
export function csrfProtection(request: NextRequest): NextResponse | null {
  return validateCsrfToken(request)
}
