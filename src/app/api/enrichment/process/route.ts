/**
 * API Route: Process Enrichment Queue
 *
 * POST /api/enrichment/process
 *
 * Processes pending enrichment tasks for the authenticated user's company.
 * Can be triggered manually from the UI or via Vercel Cron.
 *
 * Headers:
 * - x-cron-secret: For cron authentication (bypasses user auth)
 *
 * Query params:
 * - batchSize: Number of tasks to process (default: 10, max: 50)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers, companies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { processEnrichmentBatch } from '@/lib/services/enrichment-queue'
import { safeCompare } from '@/lib/security/timing-safe'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('api:enrichment:process')

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = env.CRON_SECRET
    const searchParams = request.nextUrl.searchParams
    const batchSize = Math.min(
      parseInt(searchParams.get('batchSize') || '50'),
      100
    )

    // Cron mode: process for all companies
    if (cronSecret && expectedSecret && safeCompare(cronSecret, expectedSecret)) {
      logger.info({ message: 'Processing enrichment queue via cron' })

      // Get all companies
      const allCompanies = await db
        .select({ id: companies.id })
        .from(companies)
        .limit(100)

      // Process companies in parallel batches to avoid N+1 pattern
      const results = await Promise.all(
        allCompanies.map(async (company) => {
          const result = await processEnrichmentBatch(company.id, batchSize)
          if (result.processed > 0) {
            return { companyId: company.id, ...result }
          }
          return null
        })
      )

      const successfulResults = results.filter((r) => r !== null)

      return NextResponse.json({
        success: true,
        mode: 'cron',
        companiesProcessed: successfulResults.length,
        results: successfulResults,
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
      return NextResponse.json(
        { error: 'No company found' },
        { status: 400 }
      )
    }

    const result = await processEnrichmentBatch(companyUser.companyId, batchSize)

    return NextResponse.json({
      success: true,
      mode: 'manual',
      ...result,
    })
  } catch (error) {
    logger.error({ message: 'Enrichment processing failed', error })
    return NextResponse.json(
      {
        error: 'Enrichment processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
