import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { db } from '@/lib/db'
import { candidateOnboardingTasks } from '@/lib/db/schema'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:candidate:onboarding')

export async function GET() {
  try {
    const session = await getCandidateSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasks = await db
      .select()
      .from(candidateOnboardingTasks)
      .where(eq(candidateOnboardingTasks.candidateUserId, session.candidateId))
      .orderBy(desc(candidateOnboardingTasks.createdAt))

    return NextResponse.json({ tasks })
  } catch (error) {
    logger.error({ message: 'Failed to fetch onboarding tasks', error })
    return NextResponse.json({ error: 'Failed to fetch onboarding tasks' }, { status: 500 })
  }
}
