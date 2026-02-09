import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Admin migration endpoint to create candidate_reach_outs table
export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.ADMIN_MIGRATION_TOKEN || 'allow-migration'

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🚀 Starting candidate_reach_outs table migration...')

    // Create candidate_reach_outs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS candidate_reach_outs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES candidate_users(id) ON DELETE CASCADE,
        employer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `)
    console.log('✅ Created candidate_reach_outs table')

    await db.execute(sql`CREATE INDEX IF NOT EXISTS candidate_reach_outs_candidate_idx ON candidate_reach_outs(candidate_id)`)
    console.log('✅ Created index on candidate_id')

    await db.execute(sql`CREATE INDEX IF NOT EXISTS candidate_reach_outs_employer_idx ON candidate_reach_outs(employer_id)`)
    console.log('✅ Created index on employer_id')

    return NextResponse.json({
      success: true,
      message: 'candidate_reach_outs table created successfully',
    })
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
