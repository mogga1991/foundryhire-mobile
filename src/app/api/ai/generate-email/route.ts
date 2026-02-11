import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { companies, candidates, jobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateJSON } from '@/lib/ai/claude'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

interface GenerateEmailBody {
  jobId: string
  candidateId?: string
  jobTitle: string
  jobDescription?: string
  candidateName?: string
  candidateCurrentCompany?: string
  candidateCurrentTitle?: string
  candidateLocation?: string
  companyName?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'formal'
  customInstructions?: string
}

interface GeneratedEmailResponse {
  subject: string
  body: string
}

const generateEmailRequestSchema = z.object({
  jobId: z.string().min(1),
  candidateId: z.string().optional(),
  jobTitle: z.string().min(1),
  jobDescription: z.string().optional(),
  candidateName: z.string().optional(),
  candidateCurrentCompany: z.string().optional(),
  candidateCurrentTitle: z.string().optional(),
  candidateLocation: z.string().optional(),
  companyName: z.string().optional(),
  tone: z.enum(["professional", "casual", "friendly", "formal"]).optional(),
  customInstructions: z.string().optional(),
})

async function _POST(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()

    // Get company name
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    const input = generateEmailRequestSchema.parse(await request.json())

    let candidateDetails = {
      name: input.candidateName || '{{firstName}}',
      currentCompany: input.candidateCurrentCompany || '{{currentCompany}}',
      currentTitle: input.candidateCurrentTitle || '',
      location: input.candidateLocation || '{{location}}',
    }

    if (input.candidateId) {
      const [candidate] = await db
        .select({
          firstName: candidates.firstName,
          lastName: candidates.lastName,
          currentCompany: candidates.currentCompany,
          currentTitle: candidates.currentTitle,
          location: candidates.location,
        })
        .from(candidates)
        .where(eq(candidates.id, input.candidateId))
        .limit(1)

      if (candidate) {
        candidateDetails = {
          name: candidate.firstName || '{{firstName}}',
          currentCompany: candidate.currentCompany || '{{currentCompany}}',
          currentTitle: candidate.currentTitle || '',
          location: candidate.location || '{{location}}',
        }
      }
    }

    let jobDescription = input.jobDescription || ''
    if (input.jobId && !jobDescription) {
      const [job] = await db
        .select({
          description: jobs.description,
          location: jobs.location,
          employmentType: jobs.employmentType,
          experienceLevel: jobs.experienceLevel,
        })
        .from(jobs)
        .where(eq(jobs.id, input.jobId))
        .limit(1)

      if (job) {
        jobDescription = job.description || ''
      }
    }

    const companyName = input.companyName || company?.name || 'our company'
    const tone = input.tone || 'professional'

    const prompt = `You are a professional recruiter writing a personalized outreach email to a potential candidate.

Generate a compelling, personalized cold outreach email that would entice the candidate to consider this opportunity.

CANDIDATE INFORMATION:
- Name: ${candidateDetails.name}
- Current Company: ${candidateDetails.currentCompany}
- Current Title: ${candidateDetails.currentTitle}
- Location: ${candidateDetails.location}

JOB INFORMATION:
- Job Title: ${input.jobTitle}
- Company: ${companyName}
${jobDescription ? `- Description: ${jobDescription.substring(0, 500)}` : ''}

REQUIREMENTS:
- Tone: ${tone}
- Keep the email concise (under 200 words for the body)
- Use template variables where appropriate: {{firstName}}, {{currentCompany}}, {{jobTitle}}, {{location}}
- The subject line should be attention-grabbing but not spammy
- Include a clear call to action
- Make it feel personal, not like a mass email
- Do NOT include a signature block
${input.customInstructions ? `- Additional instructions: ${input.customInstructions}` : ''}

Return a JSON object with two fields:
- "subject": the email subject line (string)
- "body": the email body text (string, can include line breaks as \\n)`

    const result = await generateJSON<GeneratedEmailResponse>(prompt, 1024)

    return NextResponse.json({
      subject: result.subject,
      body: result.body,
      success: true,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }
    const message = error instanceof Error ? error.message : 'Failed to generate email'
    return NextResponse.json({ error: message, success: false }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
