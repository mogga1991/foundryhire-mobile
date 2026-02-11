/**
 * API Route: Enrichment Status
 *
 * GET /api/enrichment/status
 *
 * Returns the enrichment queue summary for the authenticated user's company.
 */

import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getEnrichmentStatus } from '@/lib/services/enrichment-queue'

const logger = createLogger('api:enrichment:status')

export async function GET() {
  try {
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

    const status = await getEnrichmentStatus(companyUser.companyId)

    return NextResponse.json({
      success: true,
      ...status,
    })
  } catch (error) {
    logger.error({ message: 'Failed to get enrichment status', error })
    return NextResponse.json(
      {
        error: 'Failed to get enrichment status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
