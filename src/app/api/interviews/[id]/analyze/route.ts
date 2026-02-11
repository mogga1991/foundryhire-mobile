import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { analyzeInterview } from '@/lib/ai/interview-scoring'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('analyze-api')

// Legacy interface for backward compatibility
interface AIAnalysis {
  summary: string
  sentimentScore: number
  competencyScores: {
    technical: number
    communication: number
    safety: number
    cultureFit: number
  }
  strengths: string[]
  concerns: string[]
  recommendation: string
  suggestedFollowUp: string[]
}

// POST /api/interviews/[id]/analyze - Run AI analysis on interview transcript
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Fetch interview with transcript
    const [interview] = await db
      .select({
        id: interviews.id,
        transcript: interviews.transcript,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        jobTitle: jobs.title,
        jobRequirements: jobs.requirements,
        jobSkillsRequired: jobs.skillsRequired,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    if (!interview.transcript) {
      logger.warn({ message: 'No transcript available', interviewId })
      return NextResponse.json(
        { error: 'No transcript available for analysis' },
        { status: 400 }
      )
    }

    // Prepare context for enhanced analysis
    const jobContext = interview.jobTitle
      ? {
          title: interview.jobTitle,
          requirements: [
            ...(interview.jobRequirements || []),
            ...(interview.jobSkillsRequired || []),
          ],
        }
      : undefined

    const candidateContext = {
      name: `${interview.candidateFirstName} ${interview.candidateLastName}`,
    }

    // Run enhanced analysis
    logger.info({ message: 'Starting enhanced interview analysis', interviewId })
    const enhancedAnalysis = await analyzeInterview(
      interview.transcript,
      jobContext,
      candidateContext
    )

    // Map enhanced analysis to legacy format for backward compatibility
    const legacyCompetencyScores = {
      technical: enhancedAnalysis.competencyScores.technical.score,
      communication: enhancedAnalysis.competencyScores.communication.score,
      safety: enhancedAnalysis.competencyScores.domainExpertise.score, // Map domain expertise to safety for construction context
      cultureFit: enhancedAnalysis.competencyScores.cultureFit.score,
    }

    const legacyAnalysis: AIAnalysis = {
      summary: enhancedAnalysis.summary,
      sentimentScore: enhancedAnalysis.sentimentScore,
      competencyScores: legacyCompetencyScores,
      strengths: enhancedAnalysis.strengths,
      concerns: enhancedAnalysis.concerns,
      recommendation: enhancedAnalysis.recommendation,
      suggestedFollowUp: enhancedAnalysis.suggestedFollowUp,
    }

    // Update interview record with legacy fields for backward compatibility
    await db
      .update(interviews)
      .set({
        aiSummary: enhancedAnalysis.summary,
        aiSentimentScore: enhancedAnalysis.sentimentScore,
        aiCompetencyScores: legacyCompetencyScores,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    logger.info({ message: 'Analysis complete', interviewId, recommendation: enhancedAnalysis.recommendation, confidence: enhancedAnalysis.recommendationConfidence })

    // Notify stakeholders that AI analysis is ready (non-blocking)
    const { notifyAIAnalysisReady } = await import('@/lib/services/notifications')
    notifyAIAnalysisReady(interviewId).catch((notificationError) => {
      logger.error({
        message: 'Failed to send AI analysis ready notification',
        interviewId,
        error: notificationError,
      })
    })

    // Trigger post-interview notifications (fire and forget - non-blocking)
    const { processPostInterviewNotifications } = await import('@/lib/services/post-interview-processor')
    processPostInterviewNotifications(interviewId).catch((notificationError) => {
      logger.error({
        message: 'Failed to trigger post-interview notifications',
        interviewId,
        error: notificationError,
      })
    })

    // Return both legacy format and enhanced data
    return NextResponse.json({
      analysis: legacyAnalysis,
      enhanced: {
        competencyScoresDetailed: enhancedAnalysis.competencyScores,
        recommendation: enhancedAnalysis.recommendation,
        recommendationConfidence: enhancedAnalysis.recommendationConfidence,
        interviewQuality: enhancedAnalysis.interviewQuality,
        keyMoments: enhancedAnalysis.keyMoments,
      },
    })
  } catch (error) {
    logger.error({ message: 'Error analyzing interview', error })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('must be at least 50 characters')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze interview' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
