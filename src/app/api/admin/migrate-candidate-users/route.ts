import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('api:admin:migrate-candidate-users')

// Admin migration endpoint to create candidate_users table
// Should be called once to set up the database
export async function POST(req: NextRequest) {
  try {
    // Optional: Add authentication check here in production
    const authHeader = req.headers.get('authorization')
    const expectedToken = env.ADMIN_MIGRATION_TOKEN

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info({ message: 'Starting candidate_users table migration' })

    // Drop existing table if exists
    await db.execute(sql`DROP TABLE IF EXISTS candidate_users CASCADE`)
    logger.info({ message: 'Dropped existing candidate_users table' })

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
    logger.info({ message: 'Created candidate_users table' })

    // Create index on email
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS candidate_users_email_idx ON candidate_users(email)`)
    logger.info({ message: 'Created unique index on email' })

    return NextResponse.json({
      success: true,
      message: 'candidate_users table created successfully',
    })

  } catch (error) {
    logger.error({ message: 'Migration failed', error })
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
