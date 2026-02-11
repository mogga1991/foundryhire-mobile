/**
 * API Route: Process Interview Reminders
 *
 * GET /api/cron/interview-reminders
 *
 * Processes pending interview reminders and sends emails.
 * Triggered via Vercel Cron every 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processReminders } from '@/lib/services/interview-reminders'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/security/timing-safe'

const logger = createLogger('cron:interview-reminders')

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = env.CRON_SECRET

    if (!cronSecret || !expectedSecret || !safeCompare(cronSecret, expectedSecret)) {
      logger.warn('Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Processing interview reminders...')
    const result = await processReminders()

    logger.info(
      {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
      },
      'Interview reminders processed'
    )

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    logger.error({ error }, 'Error processing interview reminders')

    return NextResponse.json(
      {
        error: 'Failed to process interview reminders',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
