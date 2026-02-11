import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { SignJWT } from 'jose'
import { env } from '@/lib/env'

const logger = createLogger('candidate-auth-login')

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Get JWT secret from validated env
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET)

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(req, RateLimitPresets.strict)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await req.json()
    const validatedData = loginSchema.parse(body)

    // Find user by email
    const [user] = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.email, validatedData.email.toLowerCase()))
      .limit(1)

    if (!user) {
      logger.warn({ message: 'Login attempt with non-existent email', email: validatedData.email })
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.passwordHash)
    if (!isValidPassword) {
      logger.warn({ message: 'Login attempt with invalid password', candidateId: user.id, email: user.email })
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login
    await db.update(candidateUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(candidateUsers.id, user.id))

    // Create JWT token
    const token = await new SignJWT({
      candidateId: user.id,
      email: user.email,
      type: 'candidate',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // 7 days
      .sign(JWT_SECRET)

    logger.info({ message: 'Candidate logged in successfully', candidateId: user.id, email: user.email })

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    })

    // Set httpOnly cookie
    response.cookies.set('candidate_session_token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response

  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    logger.error({ message: 'Candidate login failed', error })
    return NextResponse.json(
      { error: 'Server error. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
