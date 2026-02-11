/**
 * API Route: Email Queue Health Check
 *
 * GET /api/email/queue/health
 *
 * Returns health metrics for the email queue.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { emailQueue } from '@/lib/db/schema'
import { sql, and, eq, lt } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const logger = createLogger('email-queue-health')

export async function GET(request: NextRequest) {
  // Rate limiting - standard: 30 requests per minute
  const rateLimitResult = await rateLimit(request, RateLimitPresets.standard)
  if (rateLimitResult) {
    return rateLimitResult
  }

  try {
    // Require authentication
    const user = await requireAuth()

    logger.info({
      message: 'Email queue health check requested',
      userId: user.id,
    })

    // Calculate timestamp for 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    // Query for total counts by status
    const statusCounts = await db
      .select({
        status: emailQueue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(emailQueue)
      .groupBy(emailQueue.status)

    // Query for pending emails older than 5 minutes
    const [stalePendingResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(emailQueue)
      .where(
        and(
          eq(emailQueue.status, 'pending'),
          lt(emailQueue.createdAt, fiveMinutesAgo)
        )
      )

    // Query for oldest pending email
    const [oldestPendingResult] = await db
      .select({
        oldestTimestamp: sql<string>`min(${emailQueue.createdAt})`,
      })
      .from(emailQueue)
      .where(eq(emailQueue.status, 'pending'))

    // Query for last successfully sent email
    const [lastSentResult] = await db
      .select({
        lastSentTimestamp: sql<string>`max(${emailQueue.sentAt})`,
      })
      .from(emailQueue)
      .where(eq(emailQueue.status, 'sent'))

    // Build status count map
    const statusCountMap: Record<string, number> = {}
    statusCounts.forEach((row) => {
      statusCountMap[row.status] = row.count
    })

    const metrics = {
      totalPending: statusCountMap['pending'] || 0,
      totalProcessing: statusCountMap['in_progress'] || 0,
      totalSent: statusCountMap['sent'] || 0,
      totalFailed: statusCountMap['failed'] || 0,
      pendingOlderThan5Min: stalePendingResult?.count || 0,
      oldestPendingTimestamp: oldestPendingResult?.oldestTimestamp || null,
      lastSuccessfullySentTimestamp: lastSentResult?.lastSentTimestamp || null,
      statusBreakdown: statusCountMap,
      timestamp: new Date().toISOString(),
    }

    logger.info({
      message: 'Email queue health check completed',
      userId: user.id,
      metrics,
    })

    return NextResponse.json({
      success: true,
      metrics,
    })
  } catch (error) {
    logger.error({
      message: 'Email queue health check failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Email queue health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
