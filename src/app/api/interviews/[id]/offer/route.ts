import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { candidateActivities, candidates, interviews } from '@/lib/db/schema'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:interviews:offer')

const offerSchema = z.object({
  expiresAt: z.string().datetime(),
  note: z.string().max(500).optional(),
})

async function _POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params
    const body = offerSchema.parse(await request.json())
    const expiresAt = new Date(body.expiresAt)

    if (expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Offer expiry must be in the future' }, { status: 400 })
    }

    const [interview] = await db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
      })
      .from(interviews)
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    await db.transaction(async (tx) => {
      await tx
        .update(interviews)
        .set({
          candidatePortalExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, interviewId))

      await tx
        .update(candidates)
        .set({
          stage: 'offer',
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, interview.candidateId))

      await tx.insert(candidateActivities).values({
        candidateId: interview.candidateId,
        companyId,
        activityType: 'offer_extended',
        title: 'Offer extended',
        description: `Offer expires on ${expiresAt.toLocaleString('en-US')}`,
        metadata: {
          interviewId,
          offerExpiresAt: expiresAt.toISOString(),
          note: body.note || null,
        },
        performedBy: user.id,
      })
    })

    return NextResponse.json({ success: true, interviewId, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error({ message: 'Failed to set offer expiry', error })
    return NextResponse.json({ error: 'Failed to set offer expiry' }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
