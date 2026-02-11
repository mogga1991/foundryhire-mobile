import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const logger = createLogger('notifications-unread-count')

// GET /api/notifications/unread-count — Get unread notification count
export async function GET(request: NextRequest) {
  try {
    // Rate limit: 60/min (polled frequently)
    const rateLimitResult = await rateLimit(request, {
      limit: 60,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { user, companyId } = await requireCompanyAccess()

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.userId, user.id),
          eq(notifications.read, false)
        )
      )

    return NextResponse.json({ count: result?.count || 0 })
  } catch (error) {
    logger.error({ message: 'Error fetching unread count', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to get unread count' },
      { status: 500 }
    )
  }
}
