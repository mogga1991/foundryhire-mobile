/**
 * Admin endpoint to run full-text search migration on the candidates table.
 *
 * POST /api/admin/run-search-migration
 *
 * Protected by CRON_SECRET header. Creates the tsvector column,
 * trigger function, GIN index, and backfills existing rows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { SEARCH_INDEX_MIGRATIONS } from '@/lib/db/search-indexes'
import { env } from '@/lib/env'

const logger = createLogger('search-migration')

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 1 request per minute
    const rateLimitResult = await rateLimit(request, {
      limit: 1,
      window: 60000,
      identifier: (req) => `search-migration:${getIpIdentifier(req)}`,
    })

    if (rateLimitResult) {
      return rateLimitResult
    }

    // Authenticate via CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn({ message: 'Unauthorized search migration attempt' })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info({ message: 'Starting full-text search migration' })

    const startTime = Date.now()

    // Execute the migration SQL
    // Split the migration into individual statements for execution
    const statements = SEARCH_INDEX_MIGRATIONS
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement))
        logger.info({ message: 'Executed migration statement', preview: statement.substring(0, 80) })
      } catch (stmtError) {
        logger.error({
          message: 'Migration statement failed',
          error: stmtError instanceof Error ? stmtError.message : 'Unknown error',
          statement: statement.substring(0, 200),
        })
        throw stmtError
      }
    }

    const duration = Date.now() - startTime

    logger.info({
      message: 'Full-text search migration completed successfully',
      durationMs: duration,
      statementCount: statements.length,
    })

    return NextResponse.json({
      success: true,
      message: 'Full-text search migration completed',
      durationMs: duration,
      statementsExecuted: statements.length,
    })
  } catch (error) {
    logger.error({
      message: 'Search migration failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Search migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
