import { NextRequest, NextResponse } from 'next/server'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateFollowUpQuestions, type JobContext } from '@/lib/ai/follow-up-questions'
import type { EnhancedInterviewAnalysis } from '@/lib/ai/prompts/interview-analysis'
import { createLogger } from '@/lib/logger'

const logger = createLogger('follow-up-questions-api')

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(companyId: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `follow-up:${companyId}`
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

// POST /api/interviews/[id]/follow-up-questions - Generate follow-up questions based on interview analysis
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Rate limiting: 5 requests per minute per company
    if (!checkRateLimit(companyId, 5, 60000)) {
      logger.warn({ message: 'Rate limit exceeded', companyId, interviewId })
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    // Parse optional job context from request body
    const body = await request.json().catch(() => ({}))
    const jobContext: JobContext | undefined = body.jobContext

    // Fetch interview with AI analysis
    const [interview] = await db
      .select({
        id: interviews.id,
        aiSummary: interviews.aiSummary,
        aiSentimentScore: interviews.aiSentimentScore,
        aiCompetencyScores: interviews.aiCompetencyScores,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        jobTitle: jobs.title,
        jobDescription: jobs.description,
        jobRequirements: jobs.requirements,
        jobExperienceLevel: jobs.experienceLevel,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    // Check if AI analysis exists
    if (!interview.aiSummary || !interview.aiCompetencyScores) {
      logger.warn({ message: 'No AI analysis available', interviewId })
      return NextResponse.json(
        {
          error: 'No AI analysis found for this interview. Please run the analysis first using POST /api/interviews/:id/analyze',
        },
        { status: 400 }
      )
    }

    // Reconstruct EnhancedInterviewAnalysis from stored data
    // Note: We need to map the legacy format to the enhanced format
    const aiCompetencyScores = interview.aiCompetencyScores as {
      technical: number
      communication: number
      safety: number
      cultureFit: number
    }

    // Build a synthetic EnhancedInterviewAnalysis object from stored data
    // This is a simplified version - in production, you might store the full analysis
    const analysisResult: EnhancedInterviewAnalysis = {
      summary: interview.aiSummary,
      sentimentScore: interview.aiSentimentScore || 50,
      competencyScores: {
        technical: { score: aiCompetencyScores.technical || 50, evidence: [] },
        communication: { score: aiCompetencyScores.communication || 50, evidence: [] },
        problemSolving: { score: 50, evidence: [] }, // Not in legacy format
        leadership: { score: 50, evidence: [] }, // Not in legacy format
        domainExpertise: { score: aiCompetencyScores.safety || 50, evidence: [] }, // Mapped from safety
        cultureFit: { score: aiCompetencyScores.cultureFit || 50, evidence: [] },
        adaptability: { score: 50, evidence: [] }, // Not in legacy format
      },
      strengths: [],
      concerns: [],
      recommendation: 'maybe',
      recommendationConfidence: 50,
      interviewQuality: {
        questionCoverage: 70,
        candidateEngagement: 70,
        interviewerEffectiveness: 70,
      },
      suggestedFollowUp: [],
      keyMoments: [],
    }

    // Build job context from database if not provided in request
    const effectiveJobContext: JobContext | undefined =
      jobContext ||
      (interview.jobTitle
        ? {
            title: interview.jobTitle,
            description: interview.jobDescription || undefined,
            requirements: interview.jobRequirements || undefined,
            seniorityLevel: interview.jobExperienceLevel || undefined,
          }
        : undefined)

    // Generate follow-up questions
    logger.info({ message: 'Generating follow-up questions', interviewId })
    const followUpPlan = await generateFollowUpQuestions(analysisResult, effectiveJobContext)

    // Add interview ID to the plan
    followUpPlan.interviewId = interviewId

    logger.info({
      message: 'Follow-up questions generated',
      interviewId,
      questionCount: followUpPlan.questions.length,
      totalMinutes: followUpPlan.totalEstimatedMinutes,
    })

    return NextResponse.json(followUpPlan)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Error generating follow-up questions', error })

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
      if (error.message.includes('Valid analysis result is required')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate follow-up questions' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
