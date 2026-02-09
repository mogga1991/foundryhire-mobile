import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import {
  buildJobDescriptionPrompt,
  type JobDescriptionParams,
} from '@/lib/ai/prompts/job-description'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    await requireCompanyAccess()

    const body = await request.json()

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { success: false, description: null, error: 'Job title is required' },
        { status: 400 }
      )
    }

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

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const description =
      message.content[0].type === 'text' ? message.content[0].text : ''

    if (!description) {
      return NextResponse.json(
        { success: false, description: null, error: 'Failed to generate description' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, description })
  } catch (error) {
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
    console.error('POST /api/ai/generate-job-description error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate job description'
    return NextResponse.json(
      { success: false, description: null, error: errorMessage },
      { status: 500 }
    )
  }
}
