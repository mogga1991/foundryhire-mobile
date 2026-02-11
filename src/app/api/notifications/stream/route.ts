import { NextRequest } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const logger = createLogger('notifications-stream')

// GET /api/notifications/stream — Server-Sent Events for real-time notifications
export async function GET(request: NextRequest) {
  // Rate limit: 5/min (connection limit)
  const rateLimitResult = await rateLimit(request, {
    limit: 5,
    window: 60000,
    identifier: (req) => getIpIdentifier(req),
  })
  if (rateLimitResult) return rateLimitResult

  try {
    const { user, companyId } = await requireCompanyAccess()

    const encoder = new TextEncoder()
    let isConnectionClosed = false

    const stream = new ReadableStream({
      async start(controller) {
        // Track the last notification timestamp we have seen
        let lastCheckedAt = new Date()

        // Send initial keepalive
        try {
          controller.enqueue(encoder.encode(': connected\n\n'))
        } catch {
          return
        }

        const pollInterval = setInterval(async () => {
          if (isConnectionClosed) {
            clearInterval(pollInterval)
            return
          }

          try {
            // Fetch new notifications since last check
            const newNotifications = await db
              .select({
                id: notifications.id,
                type: notifications.type,
                title: notifications.title,
                message: notifications.message,
                actionUrl: notifications.actionUrl,
                metadata: notifications.metadata,
                read: notifications.read,
                createdAt: notifications.createdAt,
              })
              .from(notifications)
              .where(
                and(
                  eq(notifications.companyId, companyId),
                  eq(notifications.userId, user.id),
                  gt(notifications.createdAt, lastCheckedAt)
                )
              )
              .orderBy(desc(notifications.createdAt))
              .limit(10)

            if (newNotifications.length > 0) {
              // Update the checkpoint
              lastCheckedAt = new Date()

              for (const notification of newNotifications) {
                const data = JSON.stringify(notification)
                try {
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                } catch {
                  // Client disconnected
                  isConnectionClosed = true
                  clearInterval(pollInterval)
                  return
                }
              }
            } else {
              // Send keepalive comment to prevent connection timeout
              try {
                controller.enqueue(encoder.encode(': keepalive\n\n'))
              } catch {
                isConnectionClosed = true
                clearInterval(pollInterval)
                return
              }
            }
          } catch (error) {
            logger.error({ message: 'SSE poll error', userId: user.id, error })
            // Don't kill the stream on transient errors; just skip this tick
          }
        }, 5000) // Poll every 5 seconds

        // Handle client disconnect via abort signal
        request.signal.addEventListener('abort', () => {
          isConnectionClosed = true
          clearInterval(pollInterval)
          try {
            controller.close()
          } catch {
            // Already closed
          }
          logger.info({ message: 'SSE connection closed', userId: user.id })
        })
      },

      cancel() {
        isConnectionClosed = true
        logger.info({ message: 'SSE stream cancelled', userId: user.id })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      },
    })
  } catch (error) {
    logger.error({ message: 'Error establishing SSE stream', error })

    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Failed to establish notification stream' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
