import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { candidateReachOuts, candidateUsers, companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('candidate-reach-out')

const reachOutSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message must be less than 1000 characters'),
})

export async function POST(req: NextRequest) {
  try {
    // Get employer session
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const employerId = session.user.id

    const body = await req.json()
    const validatedData = reachOutSchema.parse(body)

    // Verify candidate exists
    const [candidate] = await db.select()
      .from(candidateUsers)
      .where(eq(candidateUsers.id, validatedData.candidateId))
      .limit(1)

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    // Get employer's company
    const [employerCompany] = await db.select({ companyId: companyUsers.companyId })
      .from(companyUsers)
      .where(eq(companyUsers.userId, employerId))
      .limit(1)

    // Create reach-out record
    const [reachOut] = await db.insert(candidateReachOuts)
      .values({
        candidateId: validatedData.candidateId,
        employerId,
        companyId: employerCompany?.companyId || null,
        message: validatedData.message,
        status: 'sent',
      })
      .returning()

    logger.info(
      {
        reachOutId: reachOut.id,
        candidateId: validatedData.candidateId,
        employerId,
      },
      'Employer reached out to candidate'
    )

    // TODO: Send email notification to candidate
    // TODO: Create in-app notification for candidate

    return NextResponse.json({
      success: true,
      reachOutId: reachOut.id,
      message: 'Message sent successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    logger.error({ error }, 'Failed to send reach-out')
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
