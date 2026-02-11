import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('notifications')

// GET /api/notifications — List notifications for the current user
async function _GET(request: NextRequest) {
  try {
    // Rate limit: 30/min
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { user, companyId } = await requireCompanyAccess()
    const url = new URL(request.url)

    const readParam = url.searchParams.get('read')
    const type = url.searchParams.get('type')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = [
      eq(notifications.companyId, companyId),
      eq(notifications.userId, user.id),
    ]

    // Filter by read/unread
    if (readParam === 'true') {
      conditions.push(eq(notifications.read, true))
    } else if (readParam === 'false') {
      conditions.push(eq(notifications.read, false))
    }

    // Filter by type
    if (type) {
      const validTypes = [
        'interview_scheduled',
        'interview_completed',
        'candidate_applied',
        'feedback_submitted',
        'ai_analysis_ready',
        'team_invite',
        'mention',
        'system',
      ]
      const types = type.split(',').filter((t) => validTypes.includes(t))
      if (types.length > 0) {
        conditions.push(inArray(notifications.type, types))
      }
    }

    // Count total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...conditions))

    const total = countResult?.count || 0
    const totalPages = Math.ceil(total / limit)

    // Fetch paginated results (newest first)
    const results = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        actionUrl: notifications.actionUrl,
        metadata: notifications.metadata,
        read: notifications.read,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      notifications: results,
      pagination: {
        page,
        perPage: limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    logger.error({ message: 'Error listing notifications', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to list notifications' },
      { status: 500 }
    )
  }
}

// Export wrapped handler with request tracing middleware
export const GET = withApiMiddleware(_GET)

// POST /api/notifications — Create a new notification
async function _POST(request: NextRequest) {
  try {
    // Rate limit: 50/min
    const rateLimitResult = await rateLimit(request, {
      limit: 50,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const { user, companyId } = await requireCompanyAccess()

    // Validate request body
    const bodySchema = z.object({
      userId: z.string().uuid(),
      type: z.enum([
        'interview_scheduled',
        'interview_completed',
        'candidate_applied',
        'feedback_submitted',
        'ai_analysis_ready',
        'team_invite',
        'mention',
        'system',
      ]),
      title: z.string().min(1).max(255),
      message: z.string().min(1),
      actionUrl: z.string().max(500).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })

    const body = await request.json()
    const validationResult = bodySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { userId, type, title, message, actionUrl, metadata } = validationResult.data

    // Create notification
    const [notification] = await db
      .insert(notifications)
      .values({
        companyId,
        userId,
        type,
        title,
        message,
        actionUrl: actionUrl || null,
        metadata: metadata || null,
      })
      .returning({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        actionUrl: notifications.actionUrl,
        metadata: notifications.metadata,
        read: notifications.read,
        createdAt: notifications.createdAt,
      })

    logger.info({ message: 'Notification created via API', notificationId: notification.id, userId, companyId })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    logger.error({ message: 'Error creating notification', error })

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
