import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, createSession } from '@/lib/auth'

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

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)

    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        name: fullName.trim(),
        passwordHash,
        emailVerified: new Date(), // Auto-verify for now
      })
      .returning({ id: users.id, email: users.email, name: users.name })

    // Create session
    await createSession(user.id)

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
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
