import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const logger = createLogger('candidate-auth-reset-password-confirm')

const confirmResetSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().min(1, 'Refresh token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(req, {
      limit: 5,
      window: 60000,
      identifier: () => getIpIdentifier(req),
    })
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await req.json()
    const validatedData = confirmResetSchema.parse(body)

    const supabase = await createSupabaseServerClient()

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: validatedData.accessToken,
      refresh_token: validatedData.refreshToken,
    })

    if (sessionError) {
      logger.warn({ sessionError }, 'Invalid Supabase recovery session')
      return NextResponse.json(
        { error: 'Invalid or expired password reset link. Please request another one.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: validatedData.newPassword,
    })

    if (updateError) {
      logger.error({ updateError }, 'Failed to update password from recovery flow')
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.',
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

    logger.error({ error }, 'Password reset confirmation failed')
    return NextResponse.json(
      { error: 'Server error. Please try again or contact support.' },
      { status: 500 }
    )
  }
}
