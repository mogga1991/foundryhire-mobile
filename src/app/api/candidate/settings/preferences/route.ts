import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { createLogger } from '@/lib/logger'

const logger = createLogger('candidate-preferences')

const preferencesSchema = z.object({
  emailNotifications: z.boolean(),
  jobAlerts: z.boolean(),
  interviewReminders: z.boolean(),
})

export async function POST(req: NextRequest) {
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

    // TODO: Save preferences to database when we add a preferences table
    // For now, just log and return success
    logger.info(
      { candidateId: session.candidateId, preferences: validatedData },
      'Email preferences updated'
    )

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
    })
  } catch (error) {
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
