import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { syncSupabaseUser } from '@/lib/auth'

const logger = createLogger('api:auth:signup')

async function _POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(request, {
      limit: 5,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const body = await request.json()
    const { email, password, fullName } = body

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists in app database
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    const syncedUser = await syncSupabaseUser(data.user)
    if (syncedUser.error) {
      return NextResponse.json({ error: syncedUser.error }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      user: syncedUser.user,
      emailConfirmationRequired: !data.session,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ message: 'Failed to create account', error })
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
