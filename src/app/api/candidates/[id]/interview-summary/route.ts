import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { candidates, interviews, interviewFeedback, jobs } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { captureError } from '@/lib/monitoring/sentry'

const logger = createLogger('interview-summary-api')

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/candidates/[id]/interview-summary
 * Return a summary of all interviews for this candidate at this company.
 * Includes: total interviews, average sentiment, competency trends, recommendation distribution.
 * Auth: requireCompanyAccess()
 * Rate limit: 20/min
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Rate limit: 20 requests per minute
    const rateLimitResponse = await rateLimit(request, {
      limit: 20,
      window: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { companyId } = await requireCompanyAccess()
    const { id: candidateId } = await context.params

    // Verify candidate exists and belongs to this company
    const [candidate] = await db
      .select({
        id: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
      })
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Fetch all interviews for this candidate at this company
    const interviewList = await db
      .select({
        id: interviews.id,
        scheduledAt: interviews.scheduledAt,
        status: interviews.status,
        interviewType: interviews.interviewType,
        aiSentimentScore: interviews.aiSentimentScore,
        aiCompetencyScores: interviews.aiCompetencyScores,
        aiSummary: interviews.aiSummary,
        jobId: interviews.jobId,
      })
      .from(interviews)
      .where(
        and(eq(interviews.candidateId, candidateId), eq(interviews.companyId, companyId))
      )
      .orderBy(interviews.scheduledAt)

    if (interviewList.length === 0) {
      return NextResponse.json({
        candidateId,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        totalInterviews: 0,
        summary: null,
        message: 'No interviews found for this candidate',
      })
    }

    // Fetch all feedback for this candidate's interviews
    const interviewIds = interviewList.map((i) => i.id)
    const allFeedback = await db
      .select({
        interviewId: interviewFeedback.interviewId,
        rating: interviewFeedback.rating,
        recommendation: interviewFeedback.recommendation,
        feedbackText: interviewFeedback.feedbackText,
      })
      .from(interviewFeedback)
      .where(sql`${interviewFeedback.interviewId} = ANY(${interviewIds})`)

    // Fetch job titles for context
    const jobIds = [...new Set(interviewList.map((i) => i.jobId).filter(Boolean))] as string[]
    let jobMap: Record<string, string> = {}
    if (jobIds.length > 0) {
      const jobRecords = await db
        .select({ id: jobs.id, title: jobs.title })
        .from(jobs)
        .where(sql`${jobs.id} = ANY(${jobIds})`)
      jobMap = Object.fromEntries(jobRecords.map((j) => [j.id, j.title]))
    }

    // Calculate summary statistics
    const completedInterviews = interviewList.filter((i) => i.status === 'completed')

    // Average sentiment from AI analysis
    const sentimentScores = completedInterviews
      .map((i) => i.aiSentimentScore)
      .filter((s): s is number => s != null)
    const averageSentiment =
      sentimentScores.length > 0
        ? Math.round(sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length)
        : null

    // Aggregate competency scores across interviews
    const competencyAggregates: Record<string, number[]> = {}
    for (const interview of completedInterviews) {
      const scores = interview.aiCompetencyScores as Record<string, number> | null
      if (scores) {
        for (const [key, value] of Object.entries(scores)) {
          if (typeof value === 'number') {
            if (!competencyAggregates[key]) competencyAggregates[key] = []
            competencyAggregates[key].push(value)
          }
        }
      }
    }

    const competencyTrends: Record<string, { average: number; count: number; trend: number[] }> = {}
    for (const [key, values] of Object.entries(competencyAggregates)) {
      competencyTrends[key] = {
        average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        count: values.length,
        trend: values, // ordered by interview date (oldest to newest)
      }
    }

    // Recommendation distribution from feedback
    const recommendationCounts: Record<string, number> = {}
    for (const fb of allFeedback) {
      if (fb.recommendation) {
        recommendationCounts[fb.recommendation] =
          (recommendationCounts[fb.recommendation] || 0) + 1
      }
    }

    // Average rating from all feedback
    const ratings = allFeedback.map((f) => f.rating)
    const averageRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null

    // Status distribution
    const statusCounts: Record<string, number> = {}
    for (const interview of interviewList) {
      statusCounts[interview.status] = (statusCounts[interview.status] || 0) + 1
    }

    // Build interview timeline
    const timeline = interviewList.map((interview) => ({
      interviewId: interview.id,
      scheduledAt: interview.scheduledAt,
      status: interview.status,
      type: interview.interviewType,
      jobTitle: interview.jobId ? jobMap[interview.jobId] || null : null,
      sentimentScore: interview.aiSentimentScore,
      feedbackCount: allFeedback.filter((f) => f.interviewId === interview.id).length,
    }))

    const summary = {
      candidateId,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      totalInterviews: interviewList.length,
      completedInterviews: completedInterviews.length,
      statusDistribution: statusCounts,
      averageSentiment,
      averageRating,
      totalFeedbackEntries: allFeedback.length,
      competencyTrends,
      recommendationDistribution: recommendationCounts,
      timeline,
    }

    logger.info({
      message: 'Interview summary generated',
      candidateId,
      totalInterviews: interviewList.length,
      completedInterviews: completedInterviews.length,
    })

    return NextResponse.json(summary)
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

    captureError(error, { component: 'interview-summary-api', action: 'GET' })
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
