import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviewFeedback, interviews } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { notifyFeedbackSubmitted } from '@/lib/services/notifications'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:interview-feedback')

const interviewFeedbackRequestSchema = z.object({
  rating: z.number().int().min(1).max(10),
  recommendation: z.string().optional(),
  feedbackText: z.string().optional(),
})

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params
    const { rating, recommendation, feedbackText } = interviewFeedbackRequestSchema.parse(await request.json())

    // Verify interview belongs to company
    const [interview] = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Check for existing feedback from this user for this interview (idempotency)
    const [existingFeedback] = await db
      .select({ id: interviewFeedback.id })
      .from(interviewFeedback)
      .where(and(
        eq(interviewFeedback.interviewId, interviewId),
        eq(interviewFeedback.userId, user.id)
      ))
      .limit(1)

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback already submitted for this interview' },
        { status: 409 }
      )
    }

    // Insert feedback and send notification in a transaction
    const result = await db.transaction(async (tx) => {
      const [feedback] = await tx.insert(interviewFeedback).values({
        interviewId,
        userId: user.id,
        rating,
        recommendation: recommendation || null,
        feedbackText: feedbackText || null,
      }).returning()

      return { feedback }
    })

    // Send in-app notification (non-blocking)
    notifyFeedbackSubmitted(interviewId, user.id).catch((err) => {
      logger.error({ message: 'Failed to send feedback notification', error: err })
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error({ message: 'Error submitting feedback', error })
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    const [interview] = await db
      .select({ id: interviews.id })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    const feedbackList = await db
      .select()
      .from(interviewFeedback)
      .where(eq(interviewFeedback.interviewId, interviewId))

    return NextResponse.json({ feedback: feedbackList })
  } catch (error) {
    logger.error({ message: 'Error fetching feedback', error })
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}
