/**
 * API Route: Process Follow-Up Scheduling
 *
 * POST /api/email/follow-ups/process
 *
 * Checks active campaigns and schedules follow-up emails.
 * Triggered via Vercel Cron every 4 hours.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAndScheduleFollowUps } from '@/lib/services/follow-up-scheduler'
import { safeCompare } from '@/lib/security/timing-safe'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('api:email:follow-ups:process')

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = env.CRON_SECRET

    if (!cronSecret || !expectedSecret || !safeCompare(cronSecret, expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info({ message: 'Checking for follow-ups to schedule' })
    const result = await checkAndScheduleFollowUps()
    logger.info({
      message: 'Follow-up scheduling completed',
      campaignsChecked: result.campaignsChecked,
      followUpsScheduled: result.followUpsScheduled,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    logger.error({
      message: 'Follow-up processing failed',
      error,
    })
    return NextResponse.json(
      {
        error: 'Follow-up processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
