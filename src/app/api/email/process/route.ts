/**
 * API Route: Process Email Queue
 *
 * POST /api/email/process
 *
 * Processes pending email queue items.
 * Can be triggered manually (with auth + rate limit) or via Vercel Cron (with secret).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { processEmailBatch, processEmailBatchForCompany } from '@/lib/services/email-queue'
import { createLogger } from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { safeCompare } from '@/lib/security/timing-safe'
import { env } from '@/lib/env'

const logger = createLogger('email-process')

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = env.CRON_SECRET
    const searchParams = request.nextUrl.searchParams
    const batchSize = Math.min(
      parseInt(searchParams.get('batchSize') || '50'),
      100
    )

    // Cron mode: process globally (no rate limiting)
    if (cronSecret && expectedSecret && safeCompare(cronSecret, expectedSecret)) {
      logger.info({
        message: 'Email queue processing triggered by cron',
        batchSize,
      })

      const result = await processEmailBatch(batchSize)

      logger.info({
        message: 'Email queue cron processing completed',
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        remaining: result.remaining,
      })

      return NextResponse.json({
        success: true,
        mode: 'cron',
        ...result,
      })
    }

    // Manual mode: require auth and rate limiting
    // Rate limiting - strict: 5 requests per minute for manual triggers
    const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const session = await getSession()
    if (!session) {
      logger.warn({
        message: 'Unauthorized email processing attempt',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      logger.warn({
        message: 'Email processing attempted by user with no company',
        userId: session.user.id,
      })
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }

    logger.info({
      message: 'Email queue processing triggered manually',
      userId: session.user.id,
      companyId: companyUser.companyId,
      batchSize,
    })

    const result = await processEmailBatchForCompany(companyUser.companyId, batchSize)

    logger.info({
      message: 'Email queue manual processing completed',
      userId: session.user.id,
      companyId: companyUser.companyId,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      remaining: result.remaining,
    })

    return NextResponse.json({
      success: true,
      mode: 'manual',
      ...result,
    })
  } catch (error) {
    logger.error({
      message: 'Email queue processing failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: 'Email queue processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
