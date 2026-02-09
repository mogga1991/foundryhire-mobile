import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL ? 'set' : 'missing',
  }

  // Test actual DB connection
  try {
    const result = await db.execute(sql`SELECT 1 as ok`)
    health.dbConnection = 'ok'
  } catch (err) {
    health.dbConnection = 'failed'
    health.dbError = err instanceof Error ? err.message : String(err)
    health.status = 'error'
  }

  // Test query
  try {
    const result = await db.select({ count: sql`count(*)` }).from(users)
    health.userCount = result[0]?.count
  } catch (err) {
    health.userQuery = 'failed'
    health.userQueryError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 503,
  })
}
