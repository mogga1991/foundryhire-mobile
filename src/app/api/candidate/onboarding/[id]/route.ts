import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { db } from '@/lib/db'
import { candidateOnboardingTasks } from '@/lib/db/schema'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:candidate:onboarding-task')

async function _PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCandidateSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = (await request.json()) as { status?: 'pending' | 'completed' }
    const nextStatus = body.status
    if (!nextStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const [updated] = await db
      .update(candidateOnboardingTasks)
      .set({
        status: nextStatus,
        completedAt: nextStatus === 'completed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(candidateOnboardingTasks.id, id),
          eq(candidateOnboardingTasks.candidateUserId, session.candidateId)
        )
      )
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task: updated })
  } catch (error) {
    logger.error({ message: 'Failed to update onboarding task', error })
    return NextResponse.json({ error: 'Failed to update onboarding task' }, { status: 500 })
  }
}

export const PATCH = withApiMiddleware(_PATCH, { csrfProtection: true })
