import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import fs from 'fs'
import path from 'path'

const logger = createLogger('migration-runner')

function isAlreadyAppliedError(message: string): boolean {
  const normalized = message.toLowerCase()
  const indicators = [
    'already exists',
    'duplicate key value violates unique constraint',
    'is duplicated',
  ]

  return indicators.some((indicator) => normalized.includes(indicator))
}

function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = []
  let buffer = ''
  let i = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false
  let dollarTag: string | null = null

  while (i < sqlText.length) {
    const ch = sqlText[i]
    const next = sqlText[i + 1]

    if (inLineComment) {
      buffer += ch
      if (ch === '\n') inLineComment = false
      i++
      continue
    }

    if (inBlockComment) {
      buffer += ch
      if (ch === '*' && next === '/') {
        buffer += next
        i += 2
        inBlockComment = false
      } else {
        i++
      }
      continue
    }

    if (dollarTag) {
      if (sqlText.startsWith(dollarTag, i)) {
        buffer += dollarTag
        i += dollarTag.length
        dollarTag = null
        continue
      }
      buffer += ch
      i++
      continue
    }

    if (inSingleQuote) {
      buffer += ch
      if (ch === '\'' && next === '\'') {
        buffer += next
        i += 2
        continue
      }
      if (ch === '\'') inSingleQuote = false
      i++
      continue
    }

    if (inDoubleQuote) {
      buffer += ch
      if (ch === '"') inDoubleQuote = false
      i++
      continue
    }

    if (ch === '-' && next === '-') {
      buffer += ch + next
      i += 2
      inLineComment = true
      continue
    }

    if (ch === '/' && next === '*') {
      buffer += ch + next
      i += 2
      inBlockComment = true
      continue
    }

    if (ch === '\'') {
      inSingleQuote = true
      buffer += ch
      i++
      continue
    }

    if (ch === '"') {
      inDoubleQuote = true
      buffer += ch
      i++
      continue
    }

    if (ch === '$') {
      const match = sqlText.slice(i).match(/^\$[A-Za-z_0-9]*\$/)
      if (match) {
        dollarTag = match[0]
        buffer += dollarTag
        i += dollarTag.length
        continue
      }
    }

    if (ch === ';') {
      const statement = buffer.trim()
      if (statement.length > 0) {
        statements.push(statement)
      }
      buffer = ''
      i++
      continue
    }

    buffer += ch
    i++
  }

  const tail = buffer.trim()
  if (tail.length > 0) {
    statements.push(tail)
  }

  return statements
}

/**
 * POST /api/admin/run-migrations
 *
 * Executes pending SQL migration files from /drizzle/ directory in order.
 * Protected by CRON_SECRET header for secure automated execution.
 * Tracks which migrations have been run via a _migrations table.
 *
 * Rate limit: 1 request per minute
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Rate limit: 1/min to prevent accidental duplicate runs
    const rateLimitResult = await rateLimit(request, {
      limit: 1,
      window: 60000,
      identifier: (req) => `migrations:${getIpIdentifier(req)}`,
    })
    if (rateLimitResult) return rateLimitResult

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.CRON_SECRET

    if (!cronSecret) {
      logger.error({ message: 'CRON_SECRET environment variable is not set' })
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn({ message: 'Unauthorized migration attempt' })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      )
    }

    // Use raw neon SQL for DDL operations (not Drizzle ORM)
    const sql = neon(env.DATABASE_URL)

    // Ensure the _migrations tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
        checksum TEXT,
        execution_time_ms INTEGER
      )
    `

    // Get already-executed migrations
    const executedRows = await sql`
      SELECT filename FROM _migrations ORDER BY filename
    ` as Array<{ filename: string }>
    const executedSet = new Set(executedRows.map(r => r.filename))

    // Read migration files from /drizzle/ directory
    const drizzleDir = path.join(process.cwd(), 'drizzle')

    if (!fs.existsSync(drizzleDir)) {
      return NextResponse.json(
        { error: 'Drizzle migrations directory not found', path: drizzleDir },
        { status: 500 }
      )
    }

    const files = fs.readdirSync(drizzleDir)
      .filter((f) => f.endsWith('.sql'))
      .sort() // Lexicographic sort ensures proper order (0000, 0001, 0002, ...)

    const results: Array<{
      filename: string
      status: 'executed' | 'skipped' | 'failed'
      executionTimeMs?: number
      error?: string
    }> = []

    let executed = 0
    let skipped = 0
    let failed = 0

    for (const filename of files) {
      // Skip already-executed migrations
      if (executedSet.has(filename)) {
        results.push({ filename, status: 'skipped' })
        skipped++
        continue
      }

      const filePath = path.join(drizzleDir, filename)
      const migrationSql = fs.readFileSync(filePath, 'utf-8')

      // Compute a simple checksum for auditing
      const crypto = await import('crypto')
      const checksum = crypto.createHash('sha256').update(migrationSql).digest('hex').slice(0, 16)

      const migrationStart = Date.now()

      try {
        // Execute migration SQL one statement at a time.
        // Prefer Drizzle breakpoints when present; otherwise split safely.
        const statements = migrationSql.includes('--> statement-breakpoint')
          ? migrationSql
              .split('--> statement-breakpoint')
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : splitSqlStatements(migrationSql)

        for (const statement of statements) {
          // Execute raw migration SQL statements (Neon requires sql.query for plain strings)
          await sql.query(statement)
        }

        const executionTimeMs = Date.now() - migrationStart

        // Record the migration as executed
        await sql`
          INSERT INTO _migrations (filename, checksum, execution_time_ms)
          VALUES (${filename}, ${checksum}, ${executionTimeMs})
        `

        results.push({ filename, status: 'executed', executionTimeMs })
        executed++

        logger.info({
          message: 'Migration executed successfully',
          filename,
          executionTimeMs,
          checksum,
        })
      } catch (error) {
        const executionTimeMs = Date.now() - migrationStart
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Handle schema drift safely: migration objects may already exist even if _migrations is empty.
        if (isAlreadyAppliedError(errorMessage)) {
          await sql`
            INSERT INTO _migrations (filename, checksum, execution_time_ms)
            VALUES (${filename}, ${checksum}, ${executionTimeMs})
            ON CONFLICT (filename) DO NOTHING
          `

          results.push({ filename, status: 'skipped', executionTimeMs })
          skipped++

          logger.warn({
            message: 'Migration already applied; marked as skipped',
            filename,
            error: errorMessage,
            executionTimeMs,
          })

          continue
        }

        results.push({
          filename,
          status: 'failed',
          executionTimeMs,
          error: errorMessage,
        })
        failed++

        logger.error({
          message: 'Migration failed',
          filename,
          error: errorMessage,
          executionTimeMs,
        })

        // Stop execution on first failure to prevent cascading issues
        break
      }
    }

    const totalDurationMs = Date.now() - startTime

    logger.info({
      message: 'Migration run complete',
      totalFiles: files.length,
      executed,
      skipped,
      failed,
      totalDurationMs,
    })

    return NextResponse.json({
      success: failed === 0,
      summary: {
        totalFiles: files.length,
        executed,
        skipped,
        failed,
        totalDurationMs,
      },
      migrations: results,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    logger.error({
      message: 'Migration runner error',
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
    })

    return NextResponse.json(
      {
        error: 'Migration runner failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
