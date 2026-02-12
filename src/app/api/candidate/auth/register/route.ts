import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { syncCandidateUserFromSupabaseUser } from '@/lib/auth/candidate-session'

const logger = createLogger('candidate-auth-register')

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(req, RateLimitPresets.strict)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await req.json()
    const validatedData = registerSchema.parse(body)

    // Check if email already exists
    const existingUser = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.email, validatedData.email.toLowerCase()))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()
    const normalizedEmail = validatedData.email.toLowerCase().trim()

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: validatedData.password,
      options: {
        data: {
          first_name: validatedData.firstName.trim(),
          last_name: validatedData.lastName.trim(),
          full_name: `${validatedData.firstName.trim()} ${validatedData.lastName.trim()}`.trim(),
          role: 'candidate',
        },
      },
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create account' },
        { status: 400 }
      )
    }

    const synced = await syncCandidateUserFromSupabaseUser(data.user)
    if (!synced) {
      return NextResponse.json(
        { error: 'Authenticated user is missing required profile information' },
        { status: 400 }
      )
    }

    const [newUser] = await db
      .select()
      .from(candidateUsers)
      .where(eq(candidateUsers.id, synced.id))
      .limit(1)

    logger.info(
      { candidateId: newUser?.id ?? synced.id, email: newUser?.email ?? normalizedEmail },
      'Candidate user registered successfully'
    )

    const response = NextResponse.json({
      success: true,
      user: {
        id: newUser?.id ?? synced.id,
        firstName: newUser?.firstName ?? validatedData.firstName.trim(),
        lastName: newUser?.lastName ?? validatedData.lastName.trim(),
        email: newUser?.email ?? normalizedEmail,
      },
      emailConfirmationRequired: !data.session,
    }, { status: 201 })

    if (data.session) {
      response.cookies.set('candidate_session_token', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

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

    logger.error({ error }, 'Candidate registration failed')
    return NextResponse.json(
      { error: 'Server error. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
