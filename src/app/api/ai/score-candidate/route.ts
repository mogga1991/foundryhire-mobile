import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateJSON } from '@/lib/ai/claude'
import {
  buildCandidateScoringPrompt,
  type CandidateScoringResult,
  type JobDetails,
  type CandidateProfile,
} from '@/lib/ai/prompts/candidate-scoring'
import { rateLimit, RateLimitPresets, getEndpointIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:ai:score-candidate')

async function _POST(request: NextRequest) {
  // Apply AI-specific rate limiting (more restrictive for expensive operations)
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.ai,
    identifier: (req) => getEndpointIdentifier(req, 'ai-score'),
  })
  if (rateLimitResult) return rateLimitResult

  try {
    const { companyId } = await requireCompanyAccess()

    const body = await request.json()
    const { jobId, candidateProfile } = body

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    if (!candidateProfile) {
      return NextResponse.json({ error: 'candidateProfile is required' }, { status: 400 })
    }

    // Fetch job and verify it belongs to this company
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)),
      with: { company: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const jobDetails: JobDetails = {
      title: job.title,
      required_skills: job.skillsRequired || [],
      nice_to_have_skills: job.skillsPreferred || [],
      experience_years_min: parseInt(job.experienceLevel || '0') || 0,
      location: job.location || 'Not specified',
      industry_sector: job.company?.industrySector || 'Construction',
    }

    const profile: CandidateProfile = {
      name: candidateProfile.name || `${candidateProfile.first_name || ''} ${candidateProfile.last_name || ''}`.trim(),
      currentTitle: candidateProfile.currentTitle || candidateProfile.current_title || 'Not specified',
      currentCompany: candidateProfile.currentCompany || candidateProfile.current_company || 'Not specified',
      yearsExperience: candidateProfile.yearsExperience || candidateProfile.experience_years || 0,
      skills: candidateProfile.skills || [],
      location: candidateProfile.location || 'Not specified',
    }

    const prompt = buildCandidateScoringPrompt(jobDetails, profile)
    const result = await generateJSON<CandidateScoringResult>(prompt, 2048)

    const score = Math.max(0, Math.min(100, result.score))

    return NextResponse.json({
      score,
      reasoning: result.reasoning,
      strengths: result.strengths || [],
      concerns: result.concerns || [],
      recommendation: result.recommendation,
      success: true,
    })
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Failed to score candidate'
    logger.error({ error: err }, 'Failed to score candidate')
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
