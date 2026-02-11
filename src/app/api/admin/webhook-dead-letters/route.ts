/**
 * Webhook Dead Letter Queue Management
 *
 * Allows viewing and manually retrying webhook events that have exceeded retry limits.
 * Requires admin access.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { webhookEvents } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'

const logger = createLogger('webhook-dead-letters')

// GET /api/admin/webhook-dead-letters - List dead letter events with pagination
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 30,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    // Require admin access
    await requireAdminAccess()

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const provider = url.searchParams.get('provider') // Optional filter by provider
    const eventType = url.searchParams.get('eventType') // Optional filter by event type

    // Build where conditions
    const conditions = [eq(webhookEvents.status, 'dead_letter')]

    if (provider) {
      conditions.push(eq(webhookEvents.provider, provider))
    }

    if (eventType) {
      conditions.push(eq(webhookEvents.eventType, eventType))
    }

    // Count total
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookEvents)
      .where(and(...conditions))

    const total = countResult?.count || 0
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit

    // Fetch paginated results
    const deadLetters = await db
      .select({
        id: webhookEvents.id,
        provider: webhookEvents.provider,
        eventType: webhookEvents.eventType,
        eventId: webhookEvents.eventId,
        meetingId: webhookEvents.meetingId,
        payload: webhookEvents.payload,
        attempts: webhookEvents.attempts,
        maxAttempts: webhookEvents.maxAttempts,
        lastAttemptAt: webhookEvents.lastAttemptAt,
        errorMessage: webhookEvents.errorMessage,
        createdAt: webhookEvents.createdAt,
      })
      .from(webhookEvents)
      .where(and(...conditions))
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit)
      .offset(offset)

    logger.info({
      message: 'Retrieved dead letter events',
      count: deadLetters.length,
      total,
      page,
    })

    return NextResponse.json({
      deadLetters,
      total,
      page,
      totalPages,
      limit,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({
      message: 'Error listing dead letter events',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Admin access required' || error.message === 'No company found for user') {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to list dead letter events' },
      { status: 500 }
    )
  }
}

const retryDeadLetterRequestSchema = z.object({
  webhookEventId: z.string().min(1),
})

// POST /api/admin/webhook-dead-letters - Manually retry a dead letter event
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(request, {
      limit: 10,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    // Require admin access
    await requireAdminAccess()

    const body = await request.json()
    const { webhookEventId } = retryDeadLetterRequestSchema.parse(body)

    // Fetch the dead letter event
    const [deadLetter] = await db
      .select({
        id: webhookEvents.id,
        status: webhookEvents.status,
        attempts: webhookEvents.attempts,
        maxAttempts: webhookEvents.maxAttempts,
      })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, webhookEventId))
      .limit(1)

    if (!deadLetter) {
      return NextResponse.json(
        { error: 'Webhook event not found' },
        { status: 404 }
      )
    }

    if (deadLetter.status !== 'dead_letter') {
      return NextResponse.json(
        { error: 'Event is not in dead letter queue' },
        { status: 400 }
      )
    }

    // Reset attempts and move back to failed status for retry
    const nextRetryAt = new Date()
    nextRetryAt.setMinutes(nextRetryAt.getMinutes() + 1) // Retry in 1 minute

    await db
      .update(webhookEvents)
      .set({
        status: 'failed',
        attempts: 0, // Reset attempts
        nextRetryAt,
        errorMessage: null, // Clear previous error
      })
      .where(eq(webhookEvents.id, webhookEventId))

    logger.info({
      message: 'Dead letter event reset for retry',
      webhookEventId,
      nextRetryAt,
    })

    return NextResponse.json({
      success: true,
      message: 'Event scheduled for retry',
      nextRetryAt: nextRetryAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    logger.error({
      message: 'Error retrying dead letter event',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Admin access required' || error.message === 'No company found for user') {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to retry dead letter event' },
      { status: 500 }
    )
  }
}
