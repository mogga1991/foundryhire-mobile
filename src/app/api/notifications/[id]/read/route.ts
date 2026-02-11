import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('notifications-read')

// PATCH /api/notifications/[id]/read — Mark a single notification as read
async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit: 60/min
    const rateLimitResult = await rateLimit(request, {
      limit: 60,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { id: notificationId } = await params
    const { user, companyId } = await requireCompanyAccess()

    // Validate UUID format
    const uuidSchema = z.string().uuid()
    if (!uuidSchema.safeParse(notificationId).success) {
      return NextResponse.json(
        { error: 'Invalid notification ID format' },
        { status: 400 }
      )
    }

    // Verify the notification belongs to this user and company
    const [notification] = await db
      .select({ id: notifications.id, read: notifications.read })
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.companyId, companyId),
          eq(notifications.userId, user.id)
        )
      )
      .limit(1)

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    // Already read — return success idempotently
    if (notification.read) {
      return NextResponse.json({ success: true })
    }

    await db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))

    logger.info({ message: 'Notification marked as read', notificationId, userId: user.id })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ message: 'Error marking notification as read', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
