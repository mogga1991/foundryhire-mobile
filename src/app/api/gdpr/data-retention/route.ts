/**
 * API Route: GDPR Data Retention
 *
 * POST /api/gdpr/data-retention - Run data retention cleanup for old interviews
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
import { processDataRetention } from '@/lib/services/gdpr-compliance'
import { db } from '@/lib/db'
import { gdprAuditLog } from '@/lib/db/schema'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('api:gdpr-data-retention')

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(companyId: string, limit: number = 1, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `retention:${companyId}`
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
 * POST - Run data retention cleanup
 */
const dataRetentionRequestSchema = z.object({
  retentionDays: z.number().int().min(30).max(3650).optional().default(365),
})

async function _POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()

    // Rate limiting: 1 request per minute (expensive operation)
    if (!checkRateLimit(companyId, 1, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { retentionDays } = dataRetentionRequestSchema.parse(body)

    logger.info({
      message: 'Running data retention cleanup',
      companyId,
      retentionDays,
      requestedBy: user.id,
    })

    const retentionResult = await processDataRetention(companyId, retentionDays)

    // Create audit log entry
    await db.insert(gdprAuditLog).values({
      companyId,
      action: 'data_retention_cleanup',
      targetType: 'bulk',
      targetId: null,
      requestedBy: user.id,
      details: {
        retentionDays,
        interviewsProcessed: retentionResult.interviewsProcessed,
        recordingsDeleted: retentionResult.recordingsDeleted,
        transcriptsCleared: retentionResult.transcriptsCleared,
        errors: retentionResult.errors,
      },
      completedAt: new Date(),
    })

    logger.info({
      message: 'Data retention cleanup completed',
      companyId,
      result: retentionResult,
    })

    return NextResponse.json({
      success: true,
      result: retentionResult,
      message: `Data retention cleanup completed. Processed ${retentionResult.interviewsProcessed} interviews.`,
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
      return NextResponse.json(
        { error: 'No company set up. Please create your company in Settings first.' },
        { status: 400 }
      )
    }

    logger.error({ message: 'Error processing data retention', error })

    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
