import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { candidateUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { createLogger } from '@/lib/logger'

const logger = createLogger('candidate-profile')

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  currentTitle: z.string().optional(),
  currentCompany: z.string().optional(),
  experienceYears: z.number().min(0).max(70).optional().nullable(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(500).optional(),
  skills: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const validatedData = updateProfileSchema.parse(body)

    // Update candidate user profile
    const [updatedUser] = await db.update(candidateUsers)
      .set({
        ...validatedData,
        linkedinUrl: validatedData.linkedinUrl === '' ? null : validatedData.linkedinUrl,
        updatedAt: new Date(),
      })
      .where(eq(candidateUsers.id, session.candidateId))
      .returning()

    logger.info(
      { candidateId: session.candidateId },
      'Candidate profile updated successfully'
    )

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        location: updatedUser.location,
        currentTitle: updatedUser.currentTitle,
        currentCompany: updatedUser.currentCompany,
        experienceYears: updatedUser.experienceYears,
        linkedinUrl: updatedUser.linkedinUrl,
        bio: updatedUser.bio,
        skills: updatedUser.skills,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    logger.error({ error }, 'Failed to update candidate profile')
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
