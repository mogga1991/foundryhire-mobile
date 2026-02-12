import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { sanitizeEmail } from '@/lib/security/sanitize'
import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const logger = createLogger('candidate-auth-reset-password')

const resetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limiting - 5 requests per minute per IP
    const rateLimitResult = await rateLimit(req, {
      limit: 5,
      window: 60000,
      identifier: () => getIpIdentifier(req),
    })
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await req.json()
    const validatedData = resetRequestSchema.parse(body)
    const sanitizedEmail = sanitizeEmail(validatedData.email)

    logger.info({ message: 'Password reset requested', email: sanitizedEmail })

    const supabase = await createSupabaseServerClient()
    const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
      redirectTo: `${appUrl}/portal/reset-password`,
    })

    if (error) {
      logger.error({ message: 'Supabase password reset request failed', error, email: sanitizedEmail })
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
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

    logger.error({ message: 'Password reset request failed', error })
    return NextResponse.json(
      { error: 'Server error. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
