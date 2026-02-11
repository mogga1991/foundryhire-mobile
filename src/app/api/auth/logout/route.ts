import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { deleteSession } from '@/lib/auth'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:auth:logout')

async function _POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    await deleteSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ message: 'Failed to sign out', error })
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
