import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { candidateReachOuts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { createLogger } from '@/lib/logger'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'

const logger = createLogger('candidate-reach-out-read')

interface Params {
  id: string
}

async function _POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const session = await getCandidateSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await context.params

    // Mark reach-out as read (only if it belongs to this candidate)
    const [updatedReachOut] = await db.update(candidateReachOuts)
      .set({
        status: 'read',
        readAt: new Date(),
      })
      .where(
        and(
          eq(candidateReachOuts.id, id),
          eq(candidateReachOuts.candidateId, session.candidateId)
        )
      )
      .returning()

    if (!updatedReachOut) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      )
    }

    logger.info(
      { reachOutId: id, candidateId: session.candidateId },
      'Marked reach-out as read'
    )

    return NextResponse.json({
      success: true,
      message: 'Marked as read',
    })
  } catch (error) {
    logger.error({ error }, 'Failed to mark reach-out as read')
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    )
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
