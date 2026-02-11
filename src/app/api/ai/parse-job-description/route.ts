import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { generateJSON } from '@/lib/ai/mistral'
import {
  buildParseJobDescriptionPrompt,
  type ParseJobDescriptionResult,
} from '@/lib/ai/prompts/parse-job-description'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:ai:parse-job-description')

const parseJobDescriptionRequestSchema = z.object({
  text: z.string().min(50, 'Job description text must be at least 50 characters long'),
  documentUrl: z.string().optional(),
})

async function _POST(request: NextRequest) {
  try {
    await requireCompanyAccess()

    const body = await request.json()
    const { text, documentUrl } = parseJobDescriptionRequestSchema.parse(body)

    // Build the parsing prompt
    const prompt = buildParseJobDescriptionPrompt(text)

    // Call Mistral AI to parse the job description
    const result = await generateJSON<ParseJobDescriptionResult>(prompt)

    // Validate required fields are present
    if (!result.confidence || typeof result.confidence.overall !== 'number') {
      return NextResponse.json({
        error: 'AI failed to provide confidence scores',
        success: false,
      }, { status: 500 })
    }

    // Ensure confidence is within 0-100 range
    result.confidence.overall = Math.max(0, Math.min(100, result.confidence.overall))

    // Ensure missingFields is an array
    if (!Array.isArray(result.missingFields)) {
      result.missingFields = []
    }

    // Add documentUrl to result if provided
    const responseData = {
      ...result,
      documentUrl: documentUrl || undefined,
    }

    return NextResponse.json({
      success: true,
      data: responseData,
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
    const message = err instanceof Error ? err.message : 'Failed to parse job description'
    logger.error({ message: 'Parse job description error', error: err })
    return NextResponse.json({
      error: message,
      success: false,
    }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
