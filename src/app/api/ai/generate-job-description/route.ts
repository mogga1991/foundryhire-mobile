import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import {
  buildJobDescriptionPrompt,
  type JobDescriptionParams,
} from '@/lib/ai/prompts/job-description'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('api:ai:generate-job-description')

function buildFallbackDescription(params: JobDescriptionParams): string {
  const requirements = params.requirements.length
    ? params.requirements
    : [
        'Strong communication and stakeholder management skills',
        'Ability to work safely and collaboratively on project teams',
        'Experience with project planning, coordination, and execution',
      ]

  const responsibilities = [
    `Lead day-to-day execution for ${params.title} activities and deliverables.`,
    'Coordinate with internal teams, contractors, and external stakeholders.',
    'Maintain project schedules, budgets, and quality standards.',
    'Promote a strong safety culture and ensure compliance with site requirements.',
    'Track risks, issues, and action items and communicate updates proactively.',
    'Support continuous process improvements to improve delivery outcomes.',
  ]

  const salaryLine = params.salaryRange
    ? `${params.salaryRange.currency ?? 'USD'} ${params.salaryRange.min.toLocaleString()} - ${params.salaryRange.max.toLocaleString()}`
    : 'Competitive and based on experience'

  return `**About the Role**

We are seeking a ${params.title} to join our team in ${params.location}. This role is critical to delivering high-quality outcomes while maintaining strong operational discipline, schedule reliability, and safety standards across the project lifecycle.

The ideal candidate brings a practical mindset, excellent communication skills, and the ability to coordinate effectively across multiple stakeholders in a fast-paced ${params.industrySector ?? 'Construction'} environment.

**Key Responsibilities**

${responsibilities.map((item) => `- ${item}`).join('\n')}

**Required Qualifications**

${requirements.map((item) => `- ${item}`).join('\n')}

**Preferred Qualifications**

- Prior experience in ${params.industrySector ?? 'Construction'} environments
- Familiarity with project documentation and reporting workflows
- Experience supporting multi-site or cross-functional initiatives
- Ability to balance operational priorities with strategic goals

**What We Offer**

- ${salaryLine}
- Comprehensive benefits package and paid time off
- Career growth and professional development opportunities
- Collaborative team culture focused on quality and safety
- Opportunity to make a meaningful impact on important projects`
}

const generateJobDescriptionRequestSchema = z.object({
  title: z.string().min(1),
  requirements: z.array(z.string()).optional(),
  location: z.string().optional(),
  salaryRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().optional(),
  }).optional(),
  employmentType: z.string().optional(),
  industrySector: z.string().optional(),
})

async function _POST(request: NextRequest) {
  try {
    await requireCompanyAccess()

    const body = generateJobDescriptionRequestSchema.parse(await request.json())

    const promptParams: JobDescriptionParams = {
      title: body.title,
      requirements: Array.isArray(body.requirements) ? body.requirements : [],
      location: body.location ?? 'Remote',
      salaryRange: body.salaryRange
        ? {
            min: Number(body.salaryRange.min),
            max: Number(body.salaryRange.max),
            currency: body.salaryRange.currency ?? 'USD',
          }
        : undefined,
      employmentType: body.employmentType ?? 'Full-time',
      industrySector: body.industrySector ?? 'Construction',
    }

    const prompt = buildJobDescriptionPrompt(promptParams)
    const fallbackDescription = buildFallbackDescription(promptParams)

    if (!env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        success: true,
        description: fallbackDescription,
        source: 'template',
      })
    }

    try {
      const anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      })
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })

      const description =
        message.content[0].type === 'text' ? message.content[0].text : ''

      if (!description) {
        return NextResponse.json({
          success: true,
          description: fallbackDescription,
          source: 'template',
        })
      }

      return NextResponse.json({ success: true, description, source: 'ai' })
    } catch (aiError) {
      logger.error({ message: 'AI generation failed, using fallback description', error: aiError })
      return NextResponse.json({
        success: true,
        description: fallbackDescription,
        source: 'template',
      })
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, description: null, error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, description: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json(
        { success: false, description: null, error: 'Company not found' },
        { status: 404 }
      )
    }
    logger.error({ message: 'Failed to generate job description', error })
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate job description'
    return NextResponse.json(
      { success: false, description: null, error: errorMessage },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
