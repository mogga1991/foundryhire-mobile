/**
 * API Route: Process Email Queue
 *
 * POST /api/email/process
 *
 * Processes pending email queue items.
 * Can be triggered manually or via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers, companies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { processEmailBatch, processEmailBatchForCompany } from '@/lib/services/email-queue'

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const searchParams = request.nextUrl.searchParams
    const batchSize = Math.min(
      parseInt(searchParams.get('batchSize') || '50'),
      100
    )

    // Cron mode: process globally
    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      console.log('[Email Queue Cron] Processing email queue...')
      const result = await processEmailBatch(batchSize)
      console.log(`[Email Queue Cron] Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}, Remaining: ${result.remaining}`)

      return NextResponse.json({
        success: true,
        mode: 'cron',
        ...result,
      })
    }

    // Manual mode: process for authenticated user's company
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [companyUser] = await db
      .select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, session.user.id))
      .limit(1)

    if (!companyUser) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }

    const result = await processEmailBatchForCompany(companyUser.companyId, batchSize)

    return NextResponse.json({
      success: true,
      mode: 'manual',
      ...result,
    })
  } catch (error) {
    console.error('[Email Queue] Error:', error)
    return NextResponse.json(
      {
        error: 'Email queue processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
