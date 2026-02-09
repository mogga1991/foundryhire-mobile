import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function createCandidateReachOutsTable() {
  console.log('🚀 Creating candidate_reach_outs table...')

  try {
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

    console.log('✅ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

createCandidateReachOutsTable()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
