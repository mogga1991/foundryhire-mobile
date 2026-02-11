import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'
import { rateLimit, getIpIdentifier } from '@/lib/rate-limit'
import { sanitizeEmail } from '@/lib/security/sanitize'
import { Resend } from 'resend'
import { env } from '@/lib/env'

const logger = createLogger('candidate-auth-resend-verification')

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limiting - 3 requests per minute per IP (stricter for verification)
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

    logger.info({ message: 'Verification email resend requested', email: sanitizedEmail })

    // Look up unverified user
    const [user] = await db
      .select()
      .from(candidateUsers)
      .where(eq(candidateUsers.email, sanitizedEmail))
      .limit(1)

    // Always return success to prevent email enumeration
    if (!user) {
      logger.info({ message: 'Verification resend requested for non-existent email', email: sanitizedEmail })
      return NextResponse.json({
        success: true,
        message: 'If an unverified account with that email exists, a verification link has been sent.',
      })
    }

    // Check if already verified
    if (user.emailVerified) {
      logger.info({ message: 'Verification resend requested for already verified email', candidateId: user.id })
      return NextResponse.json({
        success: true,
        message: 'If an unverified account with that email exists, a verification link has been sent.',
      })
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Store token in database
    await db
      .update(candidateUsers)
      .set({
        verificationToken,
        verificationTokenExpiry,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, user.id))

    // Send verification email via Resend
    if (env.RESEND_API_KEY) {
      try {
        const resend = new Resend(env.RESEND_API_KEY)
        const verifyUrl = `${env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/verify-email?token=${verificationToken}`

        await resend.emails.send({
          from: env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: user.email,
          subject: 'Verify Your Email - VerticalHire',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email</h1>
                </div>
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0 0 20px;">Hi ${user.firstName},</p>
                  <p style="margin: 0 0 20px;">Thanks for creating an account with VerticalHire! Please verify your email address to get started.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${verifyUrl}" style="background: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Verify Email Address</a>
                  </div>
                  <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:</p>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; word-break: break-all;">${verifyUrl}</p>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">This link will expire in 24 hours.</p>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">If you didn't create an account with VerticalHire, you can safely ignore this email.</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">VerticalHire - Candidate Portal</p>
                </div>
              </body>
            </html>
          `,
        })

        logger.info({ message: 'Verification email sent', candidateId: user.id, email: user.email })
      } catch (emailError) {
        logger.error({ message: 'Failed to send verification email', error: emailError, candidateId: user.id })
        // Don't fail the request if email fails
      }
    } else {
      logger.warn({ message: 'RESEND_API_KEY not configured, verification email not sent' })
    }

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
