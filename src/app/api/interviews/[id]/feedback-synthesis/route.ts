import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { interviews, interviewFeedback, candidates, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { synthesizeFeedback, type FeedbackSynthesis } from '@/lib/ai/feedback-synthesis'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { captureError } from '@/lib/monitoring/sentry'

const logger = createLogger('feedback-synthesis-api')

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/interviews/[id]/feedback-synthesis
 * Return cached feedback synthesis for an interview.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Rate limit: 5 requests per minute
    const rateLimitResponse = await rateLimit(request, {
      limit: 5,
      window: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await context.params

    // Verify interview belongs to company and get cached synthesis
    const [interview] = await db
      .select({
        id: interviews.id,
        internalNotes: interviews.internalNotes,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Extract cached synthesis from internalNotes JSONB
    const notes = interview.internalNotes as Record<string, unknown> | null
    const cachedSynthesis = notes?.feedbackSynthesis as FeedbackSynthesis | undefined

    if (!cachedSynthesis) {
      return NextResponse.json({
        synthesis: null,
        cached: false,
        message: 'No feedback synthesis available. Use POST to generate one.',
      })
    }

    return NextResponse.json({
      synthesis: cachedSynthesis,
      cached: true,
      generatedAt: (notes?.feedbackSynthesisGeneratedAt as string) || null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up' }, { status: 400 })
    }

    captureError(error, { component: 'feedback-synthesis-api', action: 'GET' })
    return NextResponse.json({ error: 'Failed to fetch feedback synthesis' }, { status: 500 })
  }
}

/**
 * POST /api/interviews/[id]/feedback-synthesis
 * Generate a new AI feedback synthesis from all feedback entries for this interview.
 */
async function _POST(request: NextRequest, context: RouteContext) {
  try {
    // Rate limit: 5 requests per minute
    const rateLimitResponse = await rateLimit(request, {
      limit: 5,
      window: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await context.params

    // Verify interview belongs to company
    const [interview] = await db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        interviewType: interviews.interviewType,
        internalNotes: interviews.internalNotes,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Fetch all feedback entries for this interview
    const feedbackList = await db
      .select({
        rating: interviewFeedback.rating,
        feedbackText: interviewFeedback.feedbackText,
        recommendation: interviewFeedback.recommendation,
        userId: interviewFeedback.userId,
      })
      .from(interviewFeedback)
      .where(eq(interviewFeedback.interviewId, interviewId))

    if (feedbackList.length === 0) {
      return NextResponse.json(
        { error: 'No feedback entries found for this interview' },
        { status: 400 }
      )
    }

    // Get interview context (candidate name, job title)
    let candidateName: string | undefined
    let jobTitle: string | undefined

    if (interview.candidateId) {
      const [candidate] = await db
        .select({ firstName: candidates.firstName, lastName: candidates.lastName })
        .from(candidates)
        .where(eq(candidates.id, interview.candidateId))
        .limit(1)
      if (candidate) {
        candidateName = `${candidate.firstName} ${candidate.lastName}`
      }
    }

    if (interview.jobId) {
      const [job] = await db
        .select({ title: jobs.title })
        .from(jobs)
        .where(eq(jobs.id, interview.jobId))
        .limit(1)
      if (job) {
        jobTitle = job.title
      }
    }

    logger.info({
      message: 'Generating feedback synthesis',
      interviewId,
      feedbackCount: feedbackList.length,
    })

    // Generate synthesis
    const synthesis = await synthesizeFeedback(feedbackList, {
      candidateName,
      jobTitle,
      interviewType: interview.interviewType,
    })

    // Cache synthesis in interview's internalNotes JSONB
    const currentNotes = (interview.internalNotes as Record<string, unknown>) || {}
    await db
      .update(interviews)
      .set({
        internalNotes: {
          ...currentNotes,
          feedbackSynthesis: synthesis,
          feedbackSynthesisGeneratedAt: new Date().toISOString(),
        } as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    logger.info({
      message: 'Feedback synthesis generated and cached',
      interviewId,
      overallSentiment: synthesis.overallSentiment,
    })

    return NextResponse.json({
      synthesis,
      cached: true,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up' }, { status: 400 })
    }

    captureError(error, { component: 'feedback-synthesis-api', action: 'POST' })
    logger.error({
      message: 'Failed to generate feedback synthesis',
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Failed to generate feedback synthesis' }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
