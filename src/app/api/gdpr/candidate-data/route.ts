/**
 * API Route: GDPR Candidate Data Management
 *
 * GET /api/gdpr/candidate-data?candidateId=xxx - Export candidate data (data portability)
 * DELETE /api/gdpr/candidate-data?candidateId=xxx - Process right to be forgotten
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
import {
  processRightToBeForgotten,
  exportCandidateData,
} from '@/lib/services/gdpr-compliance'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:gdpr-candidate-data')

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(companyId: string, limit: number = 3, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `gdpr:${companyId}`
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

/**
 * GET - Export candidate data (GDPR data portability)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidateId')

    // Validate candidateId
    if (!candidateId) {
      return NextResponse.json(
        { error: 'candidateId query parameter is required' },
        { status: 400 }
      )
    }

    // Rate limiting: 3 requests per minute
    if (!checkRateLimit(companyId, 3, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    logger.info({
      message: 'Exporting candidate data',
      candidateId,
      companyId,
      requestedBy: user.id,
    })

    const exportData = await exportCandidateData(candidateId, companyId)

    logger.info({
      message: 'Candidate data exported successfully',
      candidateId,
      companyId,
    })

    return NextResponse.json({
      success: true,
      data: exportData,
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
    if (
      error instanceof Error &&
      error.message === 'Candidate not found or does not belong to this company'
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    logger.error({ message: 'Error exporting candidate data', error })

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE - Process right to be forgotten (GDPR data deletion)
 */
async function _DELETE(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const { searchParams } = new URL(request.url)
    const candidateId = searchParams.get('candidateId')

    // Validate candidateId
    if (!candidateId) {
      return NextResponse.json(
        { error: 'candidateId query parameter is required' },
        { status: 400 }
      )
    }

    // Rate limiting: 3 requests per minute
    if (!checkRateLimit(companyId, 3, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    logger.info({
      message: 'Processing right to be forgotten',
      candidateId,
      companyId,
      requestedBy: user.id,
    })

    const deletionResult = await processRightToBeForgotten(candidateId, companyId, user.id)

    logger.info({
      message: 'Right to be forgotten processed successfully',
      candidateId,
      companyId,
      auditLogId: deletionResult.auditLogId,
    })

    return NextResponse.json({
      success: true,
      result: deletionResult,
      message: 'Candidate data has been successfully anonymized and deleted per GDPR requirements.',
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
    if (
      error instanceof Error &&
      error.message === 'Candidate not found or does not belong to this company'
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    logger.error({ message: 'Error processing right to be forgotten', error })

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const DELETE = withApiMiddleware(_DELETE, { csrfProtection: true })
