/**
 * Webhook Retry Cron Job
 *
 * Runs every 5 minutes to process failed webhook events.
 * Requires CRON_SECRET for authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processWebhookRetries } from '@/lib/services/webhook-retry-processor'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/security/timing-safe'

const logger = createLogger('webhook-retries-cron')

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 1 minute max execution time

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.CRON_SECRET

    if (!cronSecret) {
      logger.error({ message: 'CRON_SECRET not configured' })
      return NextResponse.json(
        { error: 'Cron authentication not configured' },
        { status: 500 }
      )
    }

    const expectedAuth = `Bearer ${cronSecret}`
    if (!authHeader || !safeCompare(authHeader, expectedAuth)) {
      logger.warn({ message: 'Unauthorized cron request' })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info({ message: 'Starting webhook retry cron job' })

    const result = await processWebhookRetries()

    logger.info({
      message: 'Webhook retry cron job completed',
      ...result,
    })

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error({
      message: 'Webhook retry cron job failed',
      error: errorMessage,
    })

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
