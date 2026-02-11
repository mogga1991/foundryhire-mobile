import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('candidate-password-change')

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

async function _POST(req: NextRequest) {
  try {
    const rateLimitResult = await rateLimit(req, {
      limit: 5,
      window: 60000,
      identifier: (req) => getIpIdentifier(req),
    })
    if (rateLimitResult) return rateLimitResult

    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const validatedData = passwordChangeSchema.parse(body)

    // Get current user
    const [user] = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.id, session.candidateId))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      validatedData.currentPassword,
      user.passwordHash
    )

    if (!isValidPassword) {
      logger.warn({ candidateId: session.candidateId }, 'Invalid current password attempt')
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(validatedData.newPassword, 12)

    // Update password
    await db.update(candidateUsers)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, session.candidateId))

    logger.info({ candidateId: session.candidateId }, 'Password changed successfully')

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
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

    logger.error({ error }, 'Failed to change password')
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
