/**
 * API Route: Apply Performance Indexes
 *
 * POST /api/admin/apply-indexes
 *
 * Applies performance indexes to the database.
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { PERFORMANCE_INDEX_MIGRATIONS } from '@/lib/db/indexes'
import { createLogger } from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'

const logger = createLogger('apply-indexes')

export async function POST(request: NextRequest) {
  // Rate limiting - strict: 5 requests per minute
  const rateLimitResult = await rateLimit(request, RateLimitPresets.strict)
  if (rateLimitResult) {
    return rateLimitResult
  }

  try {
    // Require admin access
    const { user, companyId } = await requireAdminAccess()

    logger.info({
      message: 'Index application requested',
      userId: user.id,
      email: user.email,
    })

    logger.info({
      message: 'Starting index application',
      userId: user.id,
      companyId,
    })

    const startTime = Date.now()

    // Execute the performance indexes
    await db.execute(sql.raw(PERFORMANCE_INDEX_MIGRATIONS))

    const endTime = Date.now()
    const duration = endTime - startTime

    logger.info({
      message: 'Performance indexes applied successfully',
      userId: user.id,
      companyId,
      durationMs: duration,
    })

    // Parse the SQL to count indexes
    const indexMatches = PERFORMANCE_INDEX_MIGRATIONS.match(/CREATE INDEX IF NOT EXISTS/g)
    const analyzeMatches = PERFORMANCE_INDEX_MIGRATIONS.match(/ANALYZE/g)
    const indexCount = indexMatches ? indexMatches.length : 0
    const analyzeCount = analyzeMatches ? analyzeMatches.length : 0

    return NextResponse.json({
      success: true,
      message: 'Performance indexes applied successfully',
      summary: {
        indexesCreated: indexCount,
        tablesAnalyzed: analyzeCount,
        durationMs: duration,
        appliedBy: {
          userId: user.id,
          email: user.email,
        },
        timestamp: new Date().toISOString(),
      },
      note: 'Indexes are created with IF NOT EXISTS, so already existing indexes were skipped.',
    })
  } catch (error) {
    logger.error({
      message: 'Failed to apply performance indexes',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Handle authentication/authorization errors
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Admin access required' || error.message === 'No company found for user') {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to apply performance indexes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
