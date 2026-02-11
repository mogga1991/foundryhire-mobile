import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { analyzeBias } from '@/lib/ai/bias-detection'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('bias-check-api')

// Simple in-memory rate limiting (per company)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10 // 10 requests per minute per company

function checkRateLimit(companyId: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(companyId)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(companyId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

// POST /api/interviews/[id]/bias-check - Run bias detection on interview transcript
async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Rate limiting
    if (!checkRateLimit(companyId)) {
      logger.warn({ message: 'Rate limit exceeded', companyId, interviewId })
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Fetch interview with transcript
    const [interview] = await db
      .select({
        id: interviews.id,
        transcript: interviews.transcript,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      logger.warn({ message: 'Interview not found', interviewId, companyId })
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    if (!interview.transcript) {
      logger.warn({ message: 'No transcript available', interviewId })
      return NextResponse.json(
        { error: 'No transcript available for bias analysis' },
        { status: 400 }
      )
    }

    // Run bias analysis
    logger.info({ message: 'Starting bias analysis', interviewId })
    const biasAnalysis = await analyzeBias(interview.transcript)

    logger.info({
      message: 'Bias analysis complete',
      interviewId,
      riskLevel: biasAnalysis.overallRiskLevel,
      score: biasAnalysis.overallScore
    })

    return NextResponse.json({ biasAnalysis })
  } catch (error) {
    logger.error({ message: 'Error in bias check', error })

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('must be at least 50 characters')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to run bias analysis' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
