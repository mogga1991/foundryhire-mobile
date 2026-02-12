import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { syncCandidateUserFromSupabaseUser } from '@/lib/auth/candidate-session'

const logger = createLogger('candidate-auth-login')

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(req, RateLimitPresets.strict)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await req.json()
    const validatedData = loginSchema.parse(body)

    const supabase = await createSupabaseServerClient()
    const normalizedEmail = validatedData.email.toLowerCase().trim()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: validatedData.password,
    })

    if (error || !data.user) {
      logger.warn({ message: 'Invalid candidate credentials', email: normalizedEmail })
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const synced = await syncCandidateUserFromSupabaseUser(data.user)
    if (!synced) {
      return NextResponse.json(
        { error: 'Authenticated user is missing required profile information' },
        { status: 400 }
      )
    }

    // Update last login timestamp in Neon profile row.
    await db.update(candidateUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(candidateUsers.id, synced.id))

    const [user] = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.id, synced.id))
      .limit(1)

    logger.info({ message: 'Candidate logged in successfully', candidateId: synced.id, email: synced.email })

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user?.id ?? synced.id,
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        email: user?.email ?? synced.email,
        emailVerified: user?.emailVerified ?? Boolean(data.user.email_confirmed_at),
      },
    })

    // Lightweight candidate marker cookie for middleware route gating.
    response.cookies.set('candidate_session_token', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
