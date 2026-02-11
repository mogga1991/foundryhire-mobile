/**
 * API Route: Interview Consensus Scoring
 *
 * POST /api/interviews/:id/consensus - Generate consensus score from multiple interviewer feedback
 * GET /api/interviews/:id/consensus - Retrieve cached consensus (if previously generated)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, interviewFeedback, users, interviewParticipants, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateConsensusScore, type InterviewerFeedback } from '@/lib/ai/consensus-scoring'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:consensus')

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(companyId: string, limit: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `consensus:${companyId}`
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Rate limiting: 5 requests per minute per company
    if (!checkRateLimit(companyId, 5, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    // Verify interview exists and belongs to company
    const [interview] = await db
      .select({
        id: interviews.id,
        companyId: interviews.companyId,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        aiSummary: interviews.aiSummary,
        transcript: interviews.transcript,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Fetch all feedback entries for this interview
    const feedbackRecords = await db
      .select({
        id: interviewFeedback.id,
        userId: interviewFeedback.userId,
        rating: interviewFeedback.rating,
        feedbackText: interviewFeedback.feedbackText,
        recommendation: interviewFeedback.recommendation,
        userName: users.name,
        userEmail: users.email,
      })
      .from(interviewFeedback)
      .innerJoin(users, eq(interviewFeedback.userId, users.id))
      .where(eq(interviewFeedback.interviewId, interviewId))

    // Validate at least 2 feedback entries
    if (feedbackRecords.length < 2) {
      return NextResponse.json(
        {
          error: 'Insufficient feedback for consensus',
          message: 'At least 2 interviewer feedback entries are required for consensus scoring.',
          currentFeedbackCount: feedbackRecords.length,
        },
        { status: 400 }
      )
    }

    // Get interviewer roles from participants table
    const participants = await db
      .select({
        userId: interviewParticipants.userId,
        role: interviewParticipants.role,
      })
      .from(interviewParticipants)
      .where(eq(interviewParticipants.interviewId, interviewId))

    const participantRoleMap = new Map(participants.map((p) => [p.userId, p.role]))

    // Transform feedback records into InterviewerFeedback format
    const feedbackEntries: InterviewerFeedback[] = feedbackRecords.map((record) => ({
      interviewerId: record.userId,
      interviewerName: record.userName || record.userEmail || 'Unknown',
      role: participantRoleMap.get(record.userId) || 'interviewer',
      rating: record.rating,
      recommendation: record.recommendation || 'maybe',
      feedbackText: record.feedbackText || 'No detailed feedback provided.',
      // Could extend to include competencyRatings if stored in feedback
      confidenceLevel: undefined, // Could be added to feedback schema later
    }))

    // Optionally fetch job context
    let jobContext
    if (interview.jobId) {
      const [job] = await db
        .select({
          title: jobs.title,
          requirements: jobs.requirements,
          skillsRequired: jobs.skillsRequired,
        })
        .from(jobs)
        .where(eq(jobs.id, interview.jobId))
        .limit(1)

      if (job) {
        jobContext = {
          title: job.title,
          requirements: job.requirements || undefined,
          skills: job.skillsRequired || undefined,
        }
      }
    }

    // Generate consensus score
    logger.info({
      message: 'Generating consensus score',
      interviewId,
      feedbackCount: feedbackEntries.length,
    })

    const consensusResult = await generateConsensusScore(
      interviewId,
      feedbackEntries,
      interview.aiSummary || undefined,
      jobContext
    )

    logger.info({
      message: 'Consensus score generated successfully',
      interviewId,
      recommendation: consensusResult.consensusRecommendation,
      confidence: consensusResult.confidence,
    })

    return NextResponse.json({
      success: true,
      consensus: consensusResult,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json(
        { error: 'No company set up. Please create your company in Settings first.' },
        { status: 400 }
      )
    }

    logger.error({ message: 'Error generating consensus score', error })

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
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

    // Verify interview exists and belongs to company
    const [interview] = await db
      .select({
        id: interviews.id,
        companyId: interviews.companyId,
        internalNotes: interviews.internalNotes,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Check if consensus is cached in internalNotes (as an example storage location)
    // In production, you might want a dedicated `consensusScore` JSONB field
    const internalNotes = interview.internalNotes as any

    if (internalNotes && internalNotes.consensusScore) {
      logger.info({ message: 'Returning cached consensus score', interviewId })

      return NextResponse.json({
        success: true,
        consensus: internalNotes.consensusScore,
        cached: true,
      })
    }

    return NextResponse.json(
      {
        error: 'No consensus score available',
        message: 'Generate a consensus score by POSTing to this endpoint.',
      },
      { status: 404 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json(
        { error: 'No company set up. Please create your company in Settings first.' },
        { status: 400 }
      )
    }

    logger.error({ message: 'Error retrieving consensus score', error })

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
