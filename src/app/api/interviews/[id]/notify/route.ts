import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { processPostInterviewNotifications } from '@/lib/services/post-interview-processor'
import { createLogger } from '@/lib/logger'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { RecipientType } from '@/lib/ai/interview-summary-email'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('notify-api')

// Rate limit: 5 requests per minute per company
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  analytics: true,
})

interface NotifyRequestBody {
  recipients?: RecipientType[]
}

// POST /api/interviews/[id]/notify - Manually trigger post-interview notifications
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Rate limiting
    const { success, limit, remaining, reset } = await ratelimit.limit(
      `notify:${companyId}`
    )

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          limit,
          remaining,
          reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      )
    }

    // Parse request body
    const body = await request.json() as NotifyRequestBody
    const recipients = body.recipients || ['hiring_manager', 'candidate']

    // Validate recipients
    const validRecipients: RecipientType[] = []
    for (const recipient of recipients) {
      if (recipient === 'hiring_manager' || recipient === 'candidate') {
        validRecipients.push(recipient)
      } else {
        logger.warn({
          message: 'Invalid recipient type',
          interviewId,
          recipient,
        })
      }
    }

    if (validRecipients.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid recipients specified. Must be "hiring_manager" and/or "candidate"',
        },
        { status: 400 }
      )
    }

    // Verify interview exists and belongs to company
    const [interview] = await db
      .select({
        id: interviews.id,
        aiSummary: interviews.aiSummary,
        aiCompetencyScores: interviews.aiCompetencyScores,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Check if AI analysis is complete
    if (!interview.aiSummary || !interview.aiCompetencyScores) {
      logger.warn({
        message: 'AI analysis not complete',
        interviewId,
      })
      return NextResponse.json(
        {
          error: 'AI analysis not complete. Run analysis first before sending notifications.',
        },
        { status: 400 }
      )
    }

    // Trigger notifications
    logger.info({
      message: 'Starting manual notification trigger',
      interviewId,
      recipients: validRecipients,
    })

    const result = await processPostInterviewNotifications(interviewId, validRecipients)

    if (!result.success) {
      logger.warn({
        message: 'Notifications completed with errors',
        interviewId,
        result,
      })

      return NextResponse.json(
        {
          message: 'Notifications sent with some errors',
          sent: result.sent,
          skipped: result.skipped,
          errors: result.errors,
        },
        { status: 207 } // Multi-Status
      )
    }

    logger.info({
      message: 'Notifications sent successfully',
      interviewId,
      sent: result.sent,
    })

    return NextResponse.json({
      message: 'Notifications sent successfully',
      sent: result.sent,
      skipped: result.skipped,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error triggering notifications', error })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to trigger notifications' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })

// GET /api/interviews/[id]/notify - Get notification status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Verify interview exists and belongs to company
    const [interview] = await db
      .select({
        id: interviews.id,
        aiSummary: interviews.aiSummary,
        aiCompetencyScores: interviews.aiCompetencyScores,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    const analysisComplete = !!(interview.aiSummary && interview.aiCompetencyScores)

    return NextResponse.json({
      analysisComplete,
      canSendNotifications: analysisComplete,
      // Note: In a full implementation, you'd track notification history in the database
      // For now, we just report whether notifications can be sent
      notificationHistory: [],
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error fetching notification status', error })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch notification status' },
      { status: 500 }
    )
  }
}
