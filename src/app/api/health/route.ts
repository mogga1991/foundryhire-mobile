import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const logger = createLogger('health-check')

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latencyMs?: number
  message?: string
}

/**
 * GET /api/health
 * Returns system health status for uptime monitoring.
 * No auth required. Rate limited to 60/min.
 */
export async function GET(request: NextRequest) {
  // Rate limit: 60 requests per minute
  const rateLimitResponse = await rateLimit(request, {
    limit: 60,
    window: 60000,
  })
  if (rateLimitResponse) return rateLimitResponse

  const checks: HealthCheck[] = []
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

  // Check 1: Database connectivity
  const dbCheck = await checkDatabase()
  checks.push(dbCheck)
  if (dbCheck.status === 'unhealthy') overallStatus = 'unhealthy'
  else if (dbCheck.status === 'degraded' && overallStatus === 'healthy') overallStatus = 'degraded'

  // Check 2: AI API reachability (lightweight - just verify API key is configured)
  const aiCheck = checkAiConfig()
  checks.push(aiCheck)
  if (aiCheck.status === 'unhealthy' && overallStatus === 'healthy') overallStatus = 'degraded'

  // Check 3: Memory usage
  const memoryCheck = checkMemoryUsage()
  checks.push(memoryCheck)
  if (memoryCheck.status === 'unhealthy') overallStatus = 'unhealthy'
  else if (memoryCheck.status === 'degraded' && overallStatus === 'healthy') overallStatus = 'degraded'

  const response = {
    status: overallStatus,
    checks: Object.fromEntries(checks.map((c) => [c.name, c])),
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    environment: env.NODE_ENV,
    uptime: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : undefined,
  }

  logger.info({
    message: 'Health check completed',
    status: overallStatus,
  })

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Check database connectivity by running a simple query.
 */
async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    const latencyMs = Date.now() - startTime

    // Flag as degraded if latency is over 2 seconds
    if (latencyMs > 2000) {
      return {
        name: 'database',
        status: 'degraded',
        latencyMs,
        message: 'Database responding slowly',
      }
    }

    return {
      name: 'database',
      status: 'healthy',
      latencyMs,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error'

    logger.error({
      message: 'Database health check failed',
      error: errorMessage,
    })

    return {
      name: 'database',
      status: 'unhealthy',
      latencyMs,
      message: 'Database connection failed',
    }
  }
}

/**
 * Check AI API configuration (does not make an actual API call to save cost/time).
 */
function checkAiConfig(): HealthCheck {
  const hasApiKey = !!env.ANTHROPIC_API_KEY

  if (!hasApiKey) {
    return {
      name: 'ai_api',
      status: 'unhealthy',
      message: 'ANTHROPIC_API_KEY not configured',
    }
  }

  return {
    name: 'ai_api',
    status: 'healthy',
    message: 'API key configured',
  }
}

/**
 * Check memory usage. Flag degraded if over 80%, unhealthy if over 95%.
 */
function checkMemoryUsage(): HealthCheck {
  try {
    const memUsage = process.memoryUsage()
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
    const rssMB = Math.round(memUsage.rss / 1024 / 1024)
    const usagePercent = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let message = `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%), RSS: ${rssMB}MB`

    if (usagePercent > 95) {
      status = 'unhealthy'
      message = `Critical memory usage: ${message}`
    } else if (usagePercent > 80) {
      status = 'degraded'
      message = `High memory usage: ${message}`
    }

    return {
      name: 'memory',
      status,
      message,
    }
  } catch {
    return {
      name: 'memory',
      status: 'healthy',
      message: 'Memory check not available in this runtime',
    }
  }
}
