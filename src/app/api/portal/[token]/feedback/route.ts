import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:portal:feedback')

interface RouteContext {
  params: Promise<{ token: string }>
}

const portalFeedbackRequestSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  fairProfessional: z.boolean().optional(),
  jobClarityRating: z.number().int().min(1).max(5).optional(),
  comfortRating: z.number().int().min(1).max(5).optional(),
  feedbackText: z.string().optional(),
  wouldRecommend: z.boolean().optional(),
})

// POST /api/portal/[token]/feedback - Submit candidate feedback
async function _POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params

    // Validate token and get interview
    const [interview] = await db
      .select({
        id: interviews.id,
        status: interviews.status,
        candidateId: interviews.candidateId,
        candidatePortalExpiresAt: interviews.candidatePortalExpiresAt,
      })
      .from(interviews)
      .where(eq(interviews.candidatePortalToken, token))
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (interview.candidatePortalExpiresAt && new Date() > interview.candidatePortalExpiresAt) {
      return NextResponse.json(
        { error: 'This link has expired' },
        { status: 403 }
      )
    }

    // Check if interview is completed
    if (interview.status !== 'completed') {
      return NextResponse.json(
        { error: 'Feedback can only be submitted for completed interviews' },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const {
      overallRating,
      fairProfessional,
      jobClarityRating,
      comfortRating,
      feedbackText,
      wouldRecommend,
    } = portalFeedbackRequestSchema.parse(body)

    // Get the candidate to create a user record if needed
    // Since interviewFeedback requires userId, we need to handle candidate feedback differently
    // We'll create a special "candidate feedback" user or store it in a JSON field

    // For now, we'll store the feedback in the interview's internalNotes as JSONB
    // Or we can extend the interviewFeedback table to support candidate submissions

    // Let's check if there's already candidate feedback
    const existingFeedback = await db
      .select({ id: interviews.id, internalNotes: interviews.internalNotes })
      .from(interviews)
      .where(eq(interviews.id, interview.id))
      .limit(1)

    const currentNotes = existingFeedback[0]?.internalNotes as any || {}

    // Add candidate feedback to internal notes
    const candidateFeedback = {
      submittedAt: new Date().toISOString(),
      overallRating,
      fairProfessional,
      jobClarityRating,
      comfortRating,
      feedbackText,
      wouldRecommend,
      submittedBy: 'candidate',
    }

    await db
      .update(interviews)
      .set({
        internalNotes: {
          ...currentNotes,
          candidateFeedback,
        } as any,
      })
      .where(eq(interviews.id, interview.id))

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error submitting candidate feedback', error })
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

// GET /api/portal/[token]/feedback - Get existing feedback (if any)
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params

    // Validate token and get interview
    const [interview] = await db
      .select({
        id: interviews.id,
        internalNotes: interviews.internalNotes,
        candidatePortalExpiresAt: interviews.candidatePortalExpiresAt,
      })
      .from(interviews)
      .where(eq(interviews.candidatePortalToken, token))
      .limit(1)

    if (!interview) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (interview.candidatePortalExpiresAt && new Date() > interview.candidatePortalExpiresAt) {
      return NextResponse.json(
        { error: 'This link has expired' },
        { status: 403 }
      )
    }

    const notes = interview.internalNotes as any
    const candidateFeedback = notes?.candidateFeedback || null

    return NextResponse.json({
      feedback: candidateFeedback,
      hasSubmitted: !!candidateFeedback,
    })
  } catch (error) {
    logger.error({ message: 'Error fetching candidate feedback', error })
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
