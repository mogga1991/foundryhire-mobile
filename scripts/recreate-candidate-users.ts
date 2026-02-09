import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function recreateCandidateUsers() {
  console.log('🚀 Recreating candidate_users table...')

  try {
    // Drop existing table
    await db.execute(sql`DROP TABLE IF EXISTS candidate_users CASCADE`)
    console.log('✅ Dropped candidate_users table')

    // Create candidate_users table with all required columns
    await db.execute(sql`
      CREATE TABLE candidate_users (
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
    console.log('✅ Created candidate_users table with all columns')

    // Create index on email
    await db.execute(sql`CREATE UNIQUE INDEX candidate_users_email_idx ON candidate_users(email)`)
    console.log('✅ Created unique index on email column')

    console.log('✅ Migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

recreateCandidateUsers()
  .then(() => {
    console.log('✅ All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Failed:', error)
    process.exit(1)
  })
