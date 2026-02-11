import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:candidate:auth:logout')

async function _POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const cookieStore = await cookies()

    // Delete the candidate session cookie
    cookieStore.delete('candidate_session_token')

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    logger.error({ message: 'Logout error', error })
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
