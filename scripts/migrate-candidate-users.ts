import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function migrateCandidateUsers() {
  console.log('🚀 Starting candidate_users table migration...')

  try {
    // Create candidate_users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS candidate_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        verification_token_expiry TIMESTAMPTZ,
        reset_password_token TEXT,
        reset_password_expiry TIMESTAMPTZ,
        profile_image_url TEXT,
        phone TEXT,
        location TEXT,
        current_title TEXT,
        current_company TEXT,
        linkedin_url TEXT,
        resume_url TEXT,
        bio TEXT,
        skills TEXT[],
        experience_years INTEGER,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `)

    // Create index on email
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS candidate_users_email_idx ON candidate_users(email);
    `)

    console.log('✅ candidate_users table created successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

migrateCandidateUsers()
  .then(() => {
    console.log('✅ Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
