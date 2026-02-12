import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { sanitizeEmail } from '@/lib/security/sanitize'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'

const logger = createLogger('candidate-auth-resend-verification')

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(req: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(req, {
      limit: 3,
      window: 60000,
      identifier: () => getIpIdentifier(req),
    })
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await req.json()
    const validatedData = resendVerificationSchema.parse(body)
    const sanitizedEmail = sanitizeEmail(validatedData.email)

    const supabase = await createSupabaseServerClient()
    const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: sanitizedEmail,
      options: {
        emailRedirectTo: `${appUrl}/portal/login`,
      },
    })

    if (error) {
      logger.error({ error, email: sanitizedEmail }, 'Failed to resend candidate verification email')
    }

    // Always return success to prevent account enumeration.
    return NextResponse.json({
      success: true,
      message: 'If an unverified account with that email exists, a verification link has been sent.',
    })
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

    logger.error({ message: 'Verification resend failed', error })
    return NextResponse.json(
      { error: 'Server error. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
