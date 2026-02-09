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

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')

    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Follow-Up Cron] Checking for follow-ups to schedule...')
    const result = await checkAndScheduleFollowUps()
    console.log(`[Follow-Up Cron] Checked ${result.campaignsChecked} campaigns, scheduled ${result.followUpsScheduled} follow-ups`)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Follow-Up Cron] Error:', error)
    return NextResponse.json(
      {
        error: 'Follow-up processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
