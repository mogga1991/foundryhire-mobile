import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export async function GET() {
  try {
    // Test basic database connection
    await db.execute(sql`SELECT 1`)

    // Test if users table exists and is accessible
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users)

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      userCount: userCount[0]?.count || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Database health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
