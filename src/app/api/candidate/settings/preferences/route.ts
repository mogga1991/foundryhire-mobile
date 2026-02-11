import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { createLogger } from '@/lib/logger'
import { db } from '@/lib/db'
import { candidatePreferences } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('candidate-preferences')

const preferencesSchema = z.object({
  emailNotifications: z.boolean(),
  jobAlerts: z.boolean(),
  interviewReminders: z.boolean(),
  marketingEmails: z.boolean().optional(),
})

export async function GET() {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const preferences = await db.query.candidatePreferences.findFirst({
      where: eq(candidatePreferences.candidateUserId, session.candidateId),
    })

    if (!preferences) {
      return NextResponse.json({
        emailNotifications: true,
        jobAlerts: true,
        interviewReminders: true,
        marketingEmails: false,
      })
    }

    return NextResponse.json({
      emailNotifications: preferences.emailNotifications,
      jobAlerts: preferences.jobAlerts,
      interviewReminders: preferences.interviewReminders,
      marketingEmails: preferences.marketingEmails,
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }
    logger.error({ error }, 'Failed to fetch preferences')
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

async function _POST(req: NextRequest) {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const validatedData = preferencesSchema.parse(body)

    await db
      .insert(candidatePreferences)
      .values({
        candidateUserId: session.candidateId,
        emailNotifications: validatedData.emailNotifications,
        jobAlerts: validatedData.jobAlerts,
        interviewReminders: validatedData.interviewReminders,
        marketingEmails: validatedData.marketingEmails ?? false,
      })
      .onConflictDoUpdate({
        target: candidatePreferences.candidateUserId,
        set: {
          emailNotifications: validatedData.emailNotifications,
          jobAlerts: validatedData.jobAlerts,
          interviewReminders: validatedData.interviewReminders,
          marketingEmails: validatedData.marketingEmails ?? false,
          updatedAt: new Date(),
        },
      })

    logger.info(
      { candidateId: session.candidateId, preferences: validatedData },
      'Email preferences updated'
    )

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
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

    logger.error({ error }, 'Failed to save preferences')
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
