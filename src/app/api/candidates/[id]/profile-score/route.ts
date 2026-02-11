import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { candidates, interviews, interviewFeedback } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { calculateProfileScore } from '@/lib/services/profile-scoring'
import { createLogger } from '@/lib/logger'
import { captureError } from '@/lib/monitoring/sentry'

const logger = createLogger('profile-score-api')

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/candidates/[id]/profile-score
 * Calculate and return profile completeness score for a candidate.
 * Rate limit: 30/min. Auth: requireCompanyAccess()
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Rate limit: 30 requests per minute
    const rateLimitResponse = await rateLimit(request, {
      limit: 30,
      window: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { companyId } = await requireCompanyAccess()
    const { id: candidateId } = await context.params

    // Fetch candidate data
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)))
      .limit(1)

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Count interviews for this candidate at this company
    const [interviewCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(
        and(eq(interviews.candidateId, candidateId), eq(interviews.companyId, companyId))
      )

    // Count feedback entries across all interviews for this candidate
    const [feedbackCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(interviewFeedback)
      .innerJoin(interviews, eq(interviewFeedback.interviewId, interviews.id))
      .where(
        and(eq(interviews.candidateId, candidateId), eq(interviews.companyId, companyId))
      )

    const interviewCount = interviewCountResult?.count ?? 0
    const feedbackCount = feedbackCountResult?.count ?? 0

    // Calculate profile score
    const profileScore = calculateProfileScore({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      currentTitle: candidate.currentTitle,
      currentCompany: candidate.currentCompany,
      location: candidate.location,
      skills: candidate.skills,
      headline: candidate.headline,
      about: candidate.about,
      resumeUrl: candidate.resumeUrl,
      resumeText: candidate.resumeText,
      linkedinUrl: candidate.linkedinUrl,
      portfolioUrl: candidate.portfolioUrl,
      yearsOfExperience: candidate.experienceYears,
      interviewCount,
      feedbackCount,
    })

    logger.info({
      message: 'Profile score calculated for candidate',
      candidateId,
      overallScore: profileScore.overallScore,
      tier: profileScore.tier,
    })

    return NextResponse.json({
      candidateId,
      profileScore,
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

    captureError(error, { component: 'profile-score-api', action: 'GET' })
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
