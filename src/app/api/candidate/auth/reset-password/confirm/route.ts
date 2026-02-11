import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { sanitizeUserInput } from '@/lib/security/sanitize'

const logger = createLogger('candidate-auth-reset-password-confirm')

const confirmResetSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
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
    const validatedData = confirmResetSchema.parse(body)
    const sanitizedToken = sanitizeUserInput(validatedData.token, { maxLength: 100 })

    logger.info({ message: 'Password reset confirmation attempted' })

    // Find user with valid token
    const [user] = await db
      .select()
      .from(candidateUsers)
      .where(
        and(
          eq(candidateUsers.resetPasswordToken, sanitizedToken),
          gt(candidateUsers.resetPasswordExpiry, new Date())
        )
      )
      .limit(1)

    if (!user) {
      logger.warn({ message: 'Invalid or expired reset token' })
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(validatedData.newPassword, 12)

    // Update password and clear reset token
    await db
      .update(candidateUsers)
      .set({
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, user.id))

    logger.info({ message: 'Password reset successful', candidateId: user.id, email: user.email })

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
