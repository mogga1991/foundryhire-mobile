import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RateLimitPresets, getEndpointIdentifier } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { syncSupabaseUser } from '@/lib/auth'

const logger = createLogger('api:auth:login')

export async function POST(request: NextRequest) {
  // Apply strict rate limiting for login attempts
  const rateLimitResult = await rateLimit(request, {
    ...RateLimitPresets.strict,
    identifier: (req) => getEndpointIdentifier(req, 'login'),
  })
  if (rateLimitResult) return rateLimitResult

  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const syncedUser = await syncSupabaseUser(data.user)
    if (syncedUser.error) {
      return NextResponse.json({ error: syncedUser.error }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      user: syncedUser.user,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Supabase environment is not configured')) {
      return NextResponse.json(
        { error: 'Authentication is temporarily unavailable. Please contact support.' },
        { status: 503 }
      )
    }
    logger.error({ error }, 'Login failed')
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    )
  }
}
