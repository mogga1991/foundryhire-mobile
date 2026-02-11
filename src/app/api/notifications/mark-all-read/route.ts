import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('notifications-mark-all-read')

// POST /api/notifications/mark-all-read — Mark all notifications as read
async function _POST(request: NextRequest) {
  try {
    // Rate limit: 5/min
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { user, companyId } = await requireCompanyAccess()

    const result = await db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.userId, user.id),
          eq(notifications.read, false)
        )
      )

    logger.info({ message: 'All notifications marked as read', userId: user.id, companyId })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ message: 'Error marking all notifications as read', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
