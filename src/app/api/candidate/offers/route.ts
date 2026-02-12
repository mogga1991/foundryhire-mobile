import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { withApiMiddleware } from '@/lib/middleware/api-wrapper'
import { getCandidateSession } from '@/lib/auth/candidate-session'
import { db } from '@/lib/db'
import {
  candidateOnboardingTasks,
  candidates,
  companies,
  interviews,
  jobs,
} from '@/lib/db/schema'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:candidate:offers')

const ONBOARDING_TASK_TEMPLATES = [
  {
    title: 'Complete employment eligibility form',
    description: 'Submit your employment eligibility details.',
    taskType: 'form',
    documentType: 'work_auth',
  },
  {
    title: 'Upload signed offer acknowledgement',
    description: 'Upload a signed acknowledgement document.',
    taskType: 'document',
    documentType: 'offer_letter',
  },
  {
    title: 'Upload government-issued ID',
    description: 'Provide an ID for onboarding verification.',
    taskType: 'document',
    documentType: 'government_id',
  },
]

async function getCandidateRecordIdsByEmail(email: string): Promise<string[]> {
  const rows = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(sql`LOWER(${candidates.email}) = ${email.toLowerCase()}`)

  return rows.map((row) => row.id)
}

export async function GET() {
  try {
    const session = await getCandidateSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const candidateIds = await getCandidateRecordIdsByEmail(session.email)
    if (candidateIds.length === 0) {
      return NextResponse.json({ offers: [] })
    }

    const offers = await db
      .select({
        interviewId: interviews.id,
        candidateId: candidates.id,
        companyId: companies.id,
        companyName: companies.name,
        jobTitle: jobs.title,
        stage: candidates.stage,
        interviewStatus: interviews.status,
        offerExpiresAt: interviews.candidatePortalExpiresAt,
        scheduledAt: interviews.scheduledAt,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .innerJoin(companies, eq(interviews.companyId, companies.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(
        and(
          inArray(interviews.candidateId, candidateIds),
          inArray(candidates.stage, ['offer', 'hired'])
        )
      )

    return NextResponse.json({ offers })
  } catch (error) {
    logger.error({ message: 'Failed to fetch offers', error })
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}

async function _POST(request: NextRequest) {
  try {
    const session = await getCandidateSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as { interviewId?: string; action?: string }
    if (!body.interviewId || !body.action) {
      return NextResponse.json({ error: 'interviewId and action are required' }, { status: 400 })
    }

    const candidateIds = await getCandidateRecordIdsByEmail(session.email)
    if (candidateIds.length === 0) {
      return NextResponse.json({ error: 'Candidate record not found' }, { status: 404 })
    }

    const [offer] = await db
      .select({
        interviewId: interviews.id,
        candidateId: interviews.candidateId,
        companyId: interviews.companyId,
        offerExpiresAt: interviews.candidatePortalExpiresAt,
      })
      .from(interviews)
      .where(
        and(
          eq(interviews.id, body.interviewId),
          inArray(interviews.candidateId, candidateIds)
        )
      )
      .limit(1)

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
    }

    if (offer.offerExpiresAt && offer.offerExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Offer has expired' }, { status: 410 })
    }

    if (body.action === 'decline') {
      await db.transaction(async (tx) => {
        await tx
          .update(candidates)
          .set({ stage: 'rejected', updatedAt: new Date() })
          .where(eq(candidates.id, offer.candidateId))

        await tx
          .update(interviews)
          .set({ status: 'cancelled', candidatePortalExpiresAt: new Date(), updatedAt: new Date() })
          .where(eq(interviews.id, offer.interviewId))
      })

      return NextResponse.json({ success: true, status: 'declined' })
    }

    if (body.action !== 'accept') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
    }

    const onboardingDueAt = offer.offerExpiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    await db.transaction(async (tx) => {
      await tx
        .update(candidates)
        .set({ stage: 'hired', updatedAt: new Date() })
        .where(eq(candidates.id, offer.candidateId))

      await tx
        .update(interviews)
        .set({
          status: 'completed',
          candidatePortalExpiresAt: onboardingDueAt,
          updatedAt: new Date(),
        })
        .where(eq(interviews.id, offer.interviewId))

      const existingTasks = await tx
        .select({ id: candidateOnboardingTasks.id })
        .from(candidateOnboardingTasks)
        .where(
          and(
            eq(candidateOnboardingTasks.candidateUserId, session.candidateId),
            eq(candidateOnboardingTasks.interviewId, offer.interviewId)
          )
        )
        .limit(1)

      if (existingTasks.length === 0) {
        await tx.insert(candidateOnboardingTasks).values(
          ONBOARDING_TASK_TEMPLATES.map((task) => ({
            candidateUserId: session.candidateId,
            companyId: offer.companyId,
            candidateRecordId: offer.candidateId,
            interviewId: offer.interviewId,
            title: task.title,
            description: task.description,
            taskType: task.taskType,
            documentType: task.documentType,
            dueAt: onboardingDueAt,
            required: true,
          }))
        )
      }
    })

    return NextResponse.json({ success: true, status: 'accepted' })
  } catch (error) {
    logger.error({ message: 'Failed to process offer action', error })
    return NextResponse.json({ error: 'Failed to process offer action' }, { status: 500 })
  }
}

export const POST = withApiMiddleware(_POST, { csrfProtection: true })
