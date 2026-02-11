import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { compareCandidates, type CandidateForComparison } from '@/lib/ai/candidate-comparison'
import type { JobContext } from '@/lib/ai/prompts/candidate-comparison'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('candidate-comparison-api')

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(companyId: string, maxRequests: number = 3, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `comparison:${companyId}`
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

// POST /api/jobs/[id]/candidate-comparison - Compare and rank candidates for a job
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: jobId } = await params

    // Rate limiting: 3 requests per minute per company (expensive operation)
    if (!checkRateLimit(companyId, 3, 60000)) {
      logger.warn({ message: 'Rate limit exceeded', companyId, jobId })
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    // Parse optional candidateIds from request body
    const body = await request.json().catch(() => ({}))
    const candidateIds: string[] | undefined = body.candidateIds

    // Verify job belongs to this company
    const [job] = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        requirements: jobs.requirements,
        skillsRequired: jobs.skillsRequired,
        experienceLevel: jobs.experienceLevel,
      })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .limit(1)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Build query conditions
    const queryConditions = [
      eq(interviews.jobId, jobId),
      eq(interviews.companyId, companyId),
      isNotNull(interviews.aiSummary),
      isNotNull(interviews.aiCompetencyScores),
    ]

    // Add candidate ID filter if provided
    if (candidateIds && candidateIds.length > 0) {
      if (candidateIds.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 candidates can be compared at once' },
          { status: 400 }
        )
      }
      // Filter by candidate IDs - using OR condition for each ID
      // Note: This is a simplified approach; for better performance, use `inArray` if available
    }

    // Fetch analyzed interviews for this job
    const analyzedInterviews = await db
      .select({
        interviewId: interviews.id,
        candidateId: candidates.id,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        aiSummary: interviews.aiSummary,
        aiSentimentScore: interviews.aiSentimentScore,
        aiCompetencyScores: interviews.aiCompetencyScores,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .where(and(...queryConditions))
      .limit(11) // Fetch 11 to check if there are too many

    // Filter by candidateIds if provided
    const filteredInterviews = candidateIds
      ? analyzedInterviews.filter((i) => candidateIds.includes(i.candidateId))
      : analyzedInterviews

    if (filteredInterviews.length < 2) {
      logger.warn({
        message: 'Insufficient analyzed candidates for comparison',
        jobId,
        count: filteredInterviews.length,
      })
      return NextResponse.json(
        {
          error:
            'At least 2 candidates with completed AI analysis are required for comparison. Please ensure candidates have been analyzed using POST /api/interviews/:id/analyze',
        },
        { status: 400 }
      )
    }

    if (filteredInterviews.length > 10) {
      logger.warn({
        message: 'Too many candidates for comparison',
        jobId,
        count: filteredInterviews.length,
      })
      return NextResponse.json(
        {
          error:
            'Maximum 10 candidates can be compared at once. Please specify candidateIds in the request body to limit the comparison.',
        },
        { status: 400 }
      )
    }

    // Build CandidateForComparison objects
    const candidatesForComparison: CandidateForComparison[] = filteredInterviews.map((interview) => {
      const aiCompetencyScores = interview.aiCompetencyScores as {
        technical: number
        communication: number
        safety: number
        cultureFit: number
      }

      // Calculate overall score as average of competencies
      const competencyValues = Object.values(aiCompetencyScores)
      const overallScore = Math.round(
        competencyValues.reduce((sum, score) => sum + score, 0) / competencyValues.length
      )

      // Build competency scores with evidence (empty arrays since we don't store full analysis)
      const competencyScores: Record<string, { score: number; evidence: string[] }> = {
        technical: { score: aiCompetencyScores.technical || 50, evidence: [] },
        communication: { score: aiCompetencyScores.communication || 50, evidence: [] },
        problemSolving: { score: 50, evidence: [] }, // Not in legacy format
        leadership: { score: 50, evidence: [] }, // Not in legacy format
        domainExpertise: { score: aiCompetencyScores.safety || 50, evidence: [] }, // Mapped from safety
        cultureFit: { score: aiCompetencyScores.cultureFit || 50, evidence: [] },
        adaptability: { score: 50, evidence: [] }, // Not in legacy format
      }

      return {
        candidateId: interview.candidateId,
        candidateName: `${interview.candidateFirstName} ${interview.candidateLastName}`,
        interviewId: interview.interviewId,
        competencyScores,
        overallScore,
        sentimentScore: interview.aiSentimentScore || 50,
        summary: interview.aiSummary || 'No summary available',
        recommendationConfidence: 50, // Default since we don't store this in legacy format
      }
    })

    // Build job context
    const jobContext: JobContext = {
      title: job.title,
      description: job.description || undefined,
      requirements: job.requirements || undefined,
      skillsRequired: job.skillsRequired || undefined,
      experienceLevel: job.experienceLevel || undefined,
    }

    // Perform comparison
    logger.info({
      message: 'Starting candidate comparison',
      jobId,
      candidateCount: candidatesForComparison.length,
    })

    const comparison = await compareCandidates(candidatesForComparison, jobContext)

    // Add job ID to the comparison result
    comparison.jobId = jobId

    logger.info({
      message: 'Candidate comparison completed',
      jobId,
      candidateCount: candidatesForComparison.length,
      topCandidate: comparison.rankings[0]?.candidateName,
    })

    return NextResponse.json(comparison)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error comparing candidates', error })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'No company found for user') {
        return NextResponse.json(
          { error: 'No company set up. Please create your company in Settings first.' },
          { status: 400 }
        )
      }
      if (
        error.message.includes('At least 2 candidates') ||
        error.message.includes('Maximum 10 candidates')
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ error: 'Failed to compare candidates' }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
