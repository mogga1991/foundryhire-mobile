import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { generateCsrfToken, setCsrfCookie } from '@/lib/security/csrf'

const logger = createLogger('api:csrf')

/**
 * GET /api/csrf - Generate and return a new CSRF token
 *
 * This endpoint generates a new CSRF token, sets it as an httpOnly cookie,
 * and returns it in the response body for the client to include in subsequent requests.
 *
 * Frontend usage:
 * 1. Call this endpoint to get a token
 * 2. Include the token in the X-CSRF-Token header for POST/PUT/PATCH/DELETE requests
 */
export async function GET(request: NextRequest) {
  try {
    // Generate a new CSRF token
    const token = generateCsrfToken()

    // Create response with the token
    const response = NextResponse.json({
      token,
      message: 'CSRF token generated successfully',
    })

    // Set the token as an httpOnly cookie
    setCsrfCookie(response, token)

    return response
  } catch (error) {
    logger.error({ message: 'Failed to generate CSRF token', error })
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
