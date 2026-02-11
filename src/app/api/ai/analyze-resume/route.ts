import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateJSON } from '@/lib/ai/claude'
import {
  buildResumeAnalysisPrompt,
  type ResumeAnalysisResult,
  type ResumeJobDetails,
} from '@/lib/ai/prompts/resume-analysis'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:ai:analyze-resume')

const analyzeResumeRequestSchema = z.object({
  resumeText: z.string().min(1),
  jobId: z.string().min(1),
})

async function _POST(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    const body = await request.json()
    const { resumeText, jobId } = analyzeResumeRequestSchema.parse(body)

    // Fetch job and verify it belongs to this company
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)),
      with: { company: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const jobDetails: ResumeJobDetails = {
      title: job.title,
      required_skills: job.skillsRequired || [],
      experience_years_min: parseInt(job.experienceLevel || '0') || 0,
      industry_sector: job.company?.industrySector || 'Construction',
      location: job.location || undefined,
    }

    const prompt = buildResumeAnalysisPrompt(resumeText.trim(), jobDetails)
    const result = await generateJSON<ResumeAnalysisResult>(prompt, 4096)

    return NextResponse.json({
      summary: result.summary || '',
      skills: result.skills || [],
      experience: (result.experience || []).map((exp) => ({
        title: exp.title,
        company: exp.company,
        duration: exp.duration,
        description: exp.description,
      })),
      education: (result.education || []).map((edu) => ({
        degree: edu.degree,
        institution: edu.institution,
        year: edu.year,
      })),
      certifications: result.certifications || [],
      greenFlags: result.green_flags || [],
      redFlags: result.red_flags || [],
      recommendation: result.recommendation || 'not_a_fit',
      success: true,
    })
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.issues },
        { status: 400 }
      )
    }
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company set up. Please create your company in Settings first.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Failed to analyze resume'
    logger.error({ message: 'Analyze resume error', error: err })
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
